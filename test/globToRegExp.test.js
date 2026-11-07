"use strict";

const globToRegExp = require("../lib/util/globToRegExp");

/**
 * @param {string} glob glob pattern
 * @returns {RegExp} the anchored regular expression
 */
const compile = (glob) => new RegExp(`^${globToRegExp(glob)}$`);

describe("globToRegExp", () => {
	it("should throw for a glob that is not a string", () => {
		const notAString = /** @type {string} */ (/** @type {unknown} */ (1));
		expect(() => globToRegExp(notAString)).toThrow(TypeError);
	});

	it("should translate common globs as before", () => {
		/** @type {[string, string][]} */
		const cases = [
			["*.js", "([^/]*)\\.js"],
			["src/*.css", "src\\/([^/]*)\\.css"],
			["a/b/c.txt", "a\\/b\\/c\\.txt"],
			["*.{css,scss}", "([^/]*)\\.(css|scss)"],
			["file?.js", "file.\\.js"],
			["[abc].js", "[abc]\\.js"],
			["a+b.js", "a\\+b\\.js"],
			["(x).js", "\\(x\\)\\.js"],
		];
		for (const [glob, source] of cases) {
			expect(globToRegExp(glob)).toBe(source);
		}
	});

	it("should match the same paths with globstars", () => {
		/** @type {[string, string[], string[]][]} */
		const cases = [
			[
				"**/*.css",
				["a.css", "x/a.css", "x/y/a.css"],
				["a.js", "x/a.js", "a.css/b"],
			],
			[
				"src/**/test/*.js",
				["src/test/a.js", "src/x/test/a.js", "src/x/y/test/a.js"],
				["src/test/x/a.js", "lib/test/a.js", "src/xtest/a.js"],
			],
			[
				"node_modules/**",
				["node_modules/", "node_modules/a", "node_modules/a/b/c"],
				["node_modules", "x/node_modules/a"],
			],
			["**/", ["", "a", "a/b", "a/b/"], []],
			["a/**/", ["a/", "a/b", "a/b/c", "a/b/"], ["a", "b/a/"]],
			["**/**/*.js", ["a.js", "x/a.js", "x/y/z/a.js"], ["a.css", "x/y/a.css"]],
		];
		for (const [glob, matching, others] of cases) {
			const regexp = compile(glob);
			for (const path of matching) expect(regexp.test(path)).toBe(true);
			for (const path of others) expect(regexp.test(path)).toBe(false);
		}
	});

	it("should give a valid regexp for a glob with unbalanced or invalid parts", () => {
		/** @type {[string, string][]} */
		const cases = [
			["[", "["],
			["]", "]"],
			["{", "{"],
			["}", "}"],
			["*.{css,scss", "a.{css,scss"],
			["*.css,scss}", "a.css,scss}"],
			["[z-a].js", "[z-a].js"],
			["[a*].js", "[ab].js"],
			["a\\", "a\\"],
			["\\*.js", "\\a.js"],
		];
		for (const [glob, path] of cases) {
			expect(compile(glob).test(path)).toBe(true);
		}
	});

	it("should match many globstars against a deep path in linear time", () => {
		const deep = `${"d/".repeat(20)}file.css`;
		const regexp = compile(`${"**/".repeat(14)}*.js`);
		const start = Date.now();
		expect(regexp.test(deep)).toBe(false);
		expect(Date.now() - start).toBeLessThan(1000);

		const interleaved = compile(`${"**/d/".repeat(4)}**/*.js`);
		const startInterleaved = Date.now();
		expect(interleaved.test(deep)).toBe(false);
		expect(Date.now() - startInterleaved).toBeLessThan(1000);
	});
});
