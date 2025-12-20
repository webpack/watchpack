"use strict";

const LinkResolverTest = require("../lib/LinkResolver");

describe("LinkResolver", () => {
	it("should not throw when a path resolves with ENOENT", () => {
		const resolver = new LinkResolverTest();
		const result = resolver.resolve("/path/to/nonexistent/file/or/folder");
		expect(result).toEqual(["/path/to/nonexistent/file/or/folder"]);
	});
});
