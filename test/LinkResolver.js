/*globals describe it beforeEach afterEach */
"use strict";

const should = require("should");
const LinkResolver = require("../lib/LinkResolver");

describe("LinkResolver", () => {
	it("should not throw when a path resolves with ENOENT", () => {
		const resolver = new LinkResolver();
		const result = resolver.resolve("/path/to/nonexistent/file/or/folder");
		should.exist(result);
	});
});
