/*globals describe it beforeEach afterEach */
"use strict";

require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("Watchpack", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should detect removed directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(200, function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, function() {
				testHelper.file(path.join("dir", "a"));
			});
		});
	});
});
