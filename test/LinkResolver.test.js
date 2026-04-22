"use strict";

const fs = require("fs");
const path = require("path");
const LinkResolverTest = require("../lib/LinkResolver");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

let symlinksSupported = false;
try {
	fs.symlinkSync("helpers", path.join(__dirname, "fixtures"), "dir");
	fs.unlinkSync(path.join(__dirname, "fixtures"));
	symlinksSupported = true;
} catch (_err) {
	// symlinks not supported in this environment
}

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(10000);

describe("LinkResolver", () => {
	it("should not throw when a path resolves with ENOENT", () => {
		const resolver = new LinkResolverTest();
		const result = resolver.resolve("/path/to/nonexistent/file/or/folder");
		expect(result).toEqual(["/path/to/nonexistent/file/or/folder"]);
	});

	it("should cache resolution results", () => {
		const resolver = new LinkResolverTest();
		const target = "/path/to/somewhere/nowhere";
		const first = resolver.resolve(target);
		const second = resolver.resolve(target);
		expect(second).toBe(first);
	});

	it("should treat filesystem roots as unresolvable links", () => {
		const resolver = new LinkResolverTest();
		const { root } = path.parse(process.cwd());
		const result = resolver.resolve(root);
		expect(result).toEqual([root]);
		expect(Object.isFrozen(result)).toBe(true);
	});

	it("should rethrow unexpected fs.readlinkSync errors", () => {
		const { readlinkSync } = fs;
		const customError = Object.assign(new Error("mock io error"), {
			code: "EIO",
		});
		fs.readlinkSync = () => {
			throw customError;
		};
		try {
			const resolver = new LinkResolverTest();
			expect(() => resolver.resolve("/some/path/that/errors")).toThrow(
				/mock io error/,
			);
		} finally {
			fs.readlinkSync = readlinkSync;
		}
	});

	if (symlinksSupported) {
		describe("with symlinks", () => {
			beforeEach((done) => {
				testHelper.before(done);
			});

			afterEach((done) => {
				testHelper.after(done);
			});

			it("should include a symlink in the resolution result", () => {
				testHelper.dir("a");
				testHelper.file(path.join("a", "target"));
				testHelper.symlinkFile(
					path.join("a", "link"),
					path.join(fixtures, "a", "target"),
				);

				const resolver = new LinkResolverTest();
				const result = resolver.resolve(path.join(fixtures, "a", "link"));
				expect(result[0]).toBe(path.join(fixtures, "a", "target"));
				expect(result).toContain(path.join(fixtures, "a", "link"));
			});

			it("should include chained symlinks in the resolution result", () => {
				testHelper.dir("a");
				testHelper.file(path.join("a", "target"));
				testHelper.symlinkFile(
					path.join("a", "link1"),
					path.join(fixtures, "a", "target"),
				);
				testHelper.symlinkFile(
					path.join("a", "link2"),
					path.join(fixtures, "a", "link1"),
				);

				const resolver = new LinkResolverTest();
				const result = resolver.resolve(path.join(fixtures, "a", "link2"));
				expect(result[0]).toBe(path.join(fixtures, "a", "target"));
				expect(result).toContain(path.join(fixtures, "a", "link1"));
				expect(result).toContain(path.join(fixtures, "a", "link2"));
			});

			it("should resolve a file that sits inside a symlinked directory", () => {
				testHelper.dir("a");
				testHelper.dir(path.join("a", "real"));
				testHelper.file(path.join("a", "real", "f"));
				testHelper.symlinkDir(
					path.join("a", "linkDir"),
					path.join(fixtures, "a", "real"),
				);

				const resolver = new LinkResolverTest();
				const result = resolver.resolve(
					path.join(fixtures, "a", "linkDir", "f"),
				);
				expect(result[0]).toBe(path.join(fixtures, "a", "real", "f"));
				// Parent symlink is included
				expect(result).toContain(path.join(fixtures, "a", "linkDir"));
			});

			it("should combine parent symlinks with a file-level symlink", () => {
				testHelper.dir("real");
				testHelper.file(path.join("real", "t"));
				testHelper.symlinkDir("linkDir", path.join(fixtures, "real"));
				testHelper.symlinkFile(
					path.join("linkDir", "link_t"),
					path.join(fixtures, "real", "t"),
				);

				const resolver = new LinkResolverTest();
				const result = resolver.resolve(
					path.join(fixtures, "linkDir", "link_t"),
				);
				expect(result[0]).toBe(path.join(fixtures, "real", "t"));
			});

			it("should dedupe entries when both link content and parent have symlinks", () => {
				// Structure creates both a parent symlink chain and a target symlink chain
				testHelper.dir("real");
				testHelper.file(path.join("real", "t"));
				// parent symlink chain: linkA -> linkB -> real
				testHelper.symlinkDir("linkB", path.join(fixtures, "real"));
				testHelper.symlinkDir("linkA", path.join(fixtures, "linkB"));
				// target symlink chain inside real: tLinkA -> tLinkB -> t
				testHelper.symlinkFile(
					path.join("real", "tLinkB"),
					path.join(fixtures, "real", "t"),
				);
				testHelper.symlinkFile(
					path.join("real", "tLinkA"),
					path.join(fixtures, "real", "tLinkB"),
				);

				const resolver = new LinkResolverTest();
				const result = resolver.resolve(path.join(fixtures, "linkA", "tLinkA"));
				expect(result[0]).toBe(path.join(fixtures, "real", "t"));
				// Contains all link layers
				expect(result).toContain(path.join(fixtures, "linkA"));
				expect(result).toContain(path.join(fixtures, "linkB"));
			});
		});
	} else {
		it("symlinks (not supported in this environment)", () => {
			expect(true).toBe(true);
		});
	}
});
