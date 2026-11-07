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

	it("should read escapes and ranges in a class as a regexp does", () => {
		/** @type {[string, string][]} */
		const read = [
			["[\\d-a].js", "5.js"],
			["[a-\\d].js", "-.js"],
			["[\\x41-\\x5a].js", "M.js"],
			["[\\u0041-\\u005a].js", "M.js"],
			["[\\cA-\\cZ].js", "\u0005.js"],
			["[\\c_-a].js", "Z.js"],
			["[\\101-\\132].js", "M.js"],
			["[\\0-\\7].js", "\u0003.js"],
			["[\\b-\\t].js", "\t.js"],
			["[\\f-\\r].js", "\r.js"],
			["[\\n-\\n].js", "\n.js"],
			["[\\x4-a].js", "x.js"],
			["[\\u12-a].js", "u.js"],
			["[\\v-\\v].js", "\u000B.js"],
			["[\\--a].js", "M.js"],
			["[a-].js", "-.js"],
			["[-a].js", "-.js"],
			["[\\s-\\w].js", "-.js"],
		];
		for (const [glob, path] of read) {
			expect(globToRegExp(glob)).not.toContain("\\[");
			expect(compile(glob).test(path)).toBe(true);
		}
		/** @type {string[]} */
		const literal = [
			"[\\x5a-\\x41].js",
			"[\\u005a-\\u0041].js",
			"[\\cZ-\\cA].js",
			"[\\c-a].js",
			"[\\132-\\101].js",
			"[\\7-\\1].js",
			"[\\t-\\b].js",
			"[a\\",
			"[a-\\",
			"[abc",
		];
		for (const glob of literal) {
			expect(compile(glob).test(glob)).toBe(true);
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
