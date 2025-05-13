/*globals describe it beforeEach afterEach */
"use strict";

require("should");
var path = require("path");
var fs = require("fs");
var TestHelper = require("./helpers/TestHelper");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

const IS_OSX = require("os").platform() === "darwin";
const IS_WIN = require("os").platform() === "win32";
const SUPPORTS_RECURSIVE_WATCHING = IS_OSX || IS_WIN;

describe("Assumption", function() {
	this.timeout(10000);
	var watcherToClose = null;

	beforeEach(testHelper.before);
	afterEach(function(done) {
		if (watcherToClose) {
			watcherToClose.close();
			watcherToClose = null;
		}
		testHelper.after(done);
	});

	if (!IS_OSX) {
		it("should detect removed directory", function(done) {
			testHelper.dir("watch-test-dir");
			testHelper.tick(() => {
				var watcher = (watcherToClose = fs.watch(
					path.join(fixtures, "watch-test-dir")
				));
				let gotSelfRename = false;
				let gotPermError = false;
				watcher.on("change", function(type, filename) {
					console.log("should detect removed directory: change...", type, filename)
					if (type === "rename" && filename === "watch-test-dir")
						gotSelfRename = true;
				});
				watcher.on("close", function() {
					console.log("should detect removed directory: close...")
				});
				watcher.on("error", function(err) {
					console.log("should detect removed directory: error...", err)
					if (err && err.code === "EPERM") gotPermError = true;
				});
				testHelper.tick(500, function() {
					testHelper.remove("watch-test-dir");
					testHelper.tick(3000, function() {
						if (gotPermError || gotSelfRename) done();
						else
							done(new Error("Didn't receive a event about removed directory"));
					});
				});
			});
		});
	}
});
