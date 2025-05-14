/*globals describe it beforeEach afterEach */
"use strict";

require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var getWatcherManager = require("../lib/getWatcherManager");
var OrgDirectoryWatcher = require("../lib/DirectoryWatcher");
var IS_OSX = require("os").platform() === "darwin";

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

var openWatchers = [];

var DirectoryWatcher = function(p, options) {
	var d = new OrgDirectoryWatcher(getWatcherManager(options), p, options);
	openWatchers.push(d);
	var orgClose = d.close;
	d.close = function() {
		orgClose.call(this);
		var idx = openWatchers.indexOf(d);
		if (idx < 0) throw new Error("DirectoryWatcher was already closed");
		openWatchers.splice(idx, 1);
	};
	return d;
};

describe("DirectoryWatcher", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);
	afterEach(function() {
		openWatchers.forEach(function(d) {
			console.log("DirectoryWatcher (" + d.path + ") was not closed.");
			d.close();
		});
	});

	if (!IS_OSX) {
	it("should detect removed directory", function(done) {
		console.log(">>> ...")

		testHelper.dir("watch-test-dir");
		testHelper.tick(() => {
			var d = new DirectoryWatcher(path.join(fixtures), {});
			var a = d.watch(path.join(fixtures));
			let gotDirectoryRemoved = false;
			
			a.on("error", (err) => {
				console.log(">>> error: ", err)
			});

			a.on("change", (filePath, mtime, type) => {
				console.log(">>> change: ", filePath, mtime, type)
			});
			
			a.on("remove", (filePath, mtime, type) => {
				console.log(">>> remove: ", filePath, mtime, type)
				if (type && type.includes("directory-removed")) {
					gotDirectoryRemoved = true;
				}
			});

			testHelper.tick(500, function() {
				testHelper.remove("watch-test-dir");
				testHelper.tick(3000, function() {
				if (gotDirectoryRemoved) {
					a.close();
					done();
				} else {
					a.close();
					done(new Error("Didn't receive a event about removed directory"));
				}
				});
			});
		});
	});
	}
});
