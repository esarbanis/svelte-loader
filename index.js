const { basename, extname } = require('path');
const { compile, preprocess } = require('svelte');
const { getOptions } = require('loader-utils');
const { statSync, utimesSync, writeFileSync } = require('fs');
const { fileSync } = require('tmp');

function sanitize(input) {
	return basename(input).
			replace(extname(input), '').
			replace(/[^a-zA-Z_$0-9]+/g, '_').
			replace(/^_/, '').
			replace(/_$/, '').
			replace(/^(\d)/, '_$1');
}

function capitalize(str) {
	return str[0].toUpperCase() + str.slice(1);
}

module.exports = function(source, map) {
	this.cacheable();

	const options = Object.assign({}, this.options, getOptions(this));
	const callback = this.async();

	options.filename = this.resourcePath;
	options.format = this.version === 1 ? options.format || 'cjs' : 'es';
	options.shared =
			options.format === 'es' && require.resolve('svelte/shared.js');

	if (options.emitCss) options.css = false;

	if (!options.name) options.name = capitalize(sanitize(options.filename));

	preprocess(source, options).then(processed => {
		let { code, map, css, cssMap } = compile(processed.toString(), options);

		if (options.emitCss && css) {
			const tmpobj = fileSync({ mode: 0o666, postfix: '.css' });
			css += '\n/*# sourceMappingURL=' + cssMap.toUrl() + '*/';
			code = code + `\nrequire('${tmpobj.name}');\n`;

			writeFileSync(tmpobj.name, css);
			const stats = statSync(tmpobj.name);
			console.log(stats);
			utimesSync(tmpobj.name, stats.atimeMs - 9999, stats.mtimeMs - 9999);
		}

		callback(null, code, map);
	}, err => callback(err)).catch(err => {
		// wrap error to provide correct
		// context when logging to console
		callback(new Error(`${err.name}: ${err.toString()}`));
	});
};
