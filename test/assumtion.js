/*globals describe it beforeEach afterEach */
require("should");
var path = require("path");
var fs = require("fs");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("Assumtion", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should have a file system with correct mtime behavior", function(done) {
		var i = 10;
		testHelper.tick(100, function checkMtime() {
			var before = Date.now();
			testHelper.file("a");
			var after = Date.now();
			var s = fs.statSync(path.join(fixtures, "a"));
			s.mtime.should.be.aboveOrEqual(before);
			s.mtime.should.be.below(after + 2000);
			if(i-- === 0)
				done();
			else
				testHelper.tick(100, checkMtime);
		});
	});
});

