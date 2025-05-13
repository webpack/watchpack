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

	it("should detect a file creation", function(done) {
		var d = new DirectoryWatcher(fixtures, {});
		var a = d.watch(path.join(fixtures, "a"));
		a.on("change", function(mtime) {
			mtime.should.be.type("number");
			Object.keys(d.getTimes())
				.sort()
				.should.be.eql([path.join(fixtures, "a")]);
			a.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});

	it("should detect a file change", function(done) {
		var d = new DirectoryWatcher(fixtures, {});
		testHelper.file("a");
		testHelper.tick(1000, function() {
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function(mtime) {
				mtime.should.be.type("number");
				a.close();
				done();
			});
			testHelper.tick(function() {
				testHelper.file("a");
			});
		});
	});

	it("should not detect a file change in initial scan", function(done) {
		testHelper.file("a");
		testHelper.tick(function() {
			var d = new DirectoryWatcher(fixtures, {});
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function() {
				throw new Error("should not be detected");
			});
			testHelper.tick(function() {
				a.close();
				done();
			});
		});
	});

	it("should detect a file change in initial scan with start date", function(done) {
		var start = new Date();
		testHelper.tick(1000, function() {
			testHelper.file("a");
			testHelper.tick(1000, function() {
				var d = new DirectoryWatcher(fixtures, {});
				var a = d.watch(path.join(fixtures, "a"), start);
				a.on("change", function() {
					a.close();
					done();
				});
			});
		});
	});

	it("should not detect a file change in initial scan without start date", function(done) {
		testHelper.file("a");
		testHelper.tick(200, function() {
			var d = new DirectoryWatcher(fixtures, {});
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function(mtime, type) {
				throw new Error(
					"should not be detected (" +
						type +
						" mtime=" +
						mtime +
						" now=" +
						Date.now() +
						")"
				);
			});
			testHelper.tick(function() {
				a.close();
				done();
			});
		});
	});

	var timings = {
		slow: 300,
		fast: 50
	};
	Object.keys(timings).forEach(function(name) {
		var time = timings[name];
		it("should detect multiple file changes (" + name + ")", function(done) {
			var d = new DirectoryWatcher(fixtures, {});
			testHelper.file("a");
			testHelper.tick(function() {
				var a = d.watch(path.join(fixtures, "a"));
				var count = 20;
				var wasChanged = false;
				a.on("change", function(mtime) {
					mtime.should.be.type("number");
					if (!wasChanged) return;
					wasChanged = false;
					if (count-- <= 0) {
						a.close();
						done();
					} else {
						testHelper.tick(time, function() {
							wasChanged = true;
							testHelper.file("a");
						});
					}
				});
				testHelper.tick(function() {
					wasChanged = true;
					testHelper.file("a");
				});
			});
		});
	});

	it("should detect a file removal", function(done) {
		testHelper.file("a");
		var d = new DirectoryWatcher(fixtures, {});
		var a = d.watch(path.join(fixtures, "a"));
		a.on("remove", function() {
			a.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.remove("a");
		});
	});

	it("should report directory as initial missing on the second watch when directory doesn't exist", function(done) {
		var wm = getWatcherManager({});
		testHelper.dir("dir1");
		wm.watchDirectory(path.join(fixtures, "dir1"));

		testHelper.tick(function() {
			var initialMissing = false;
			wm.watchDirectory(path.join(fixtures, "dir3")).on(
				"initial-missing",
				() => {
					initialMissing = true;
				}
			);
			testHelper.tick(function() {
				for (const [, w] of wm.directoryWatchers) {
					w.close();
				}
				initialMissing.should.be.eql(true);
				done();
			});
		});
	});

	it("should not report directory as initial missing on the second watch when directory exists", function(done) {
		var wm = getWatcherManager({});
		testHelper.dir("dir1");
		wm.watchDirectory(path.join(fixtures, "dir1"));

		testHelper.tick(function() {
			var initialMissing = false;
			wm.watchDirectory(path.join(fixtures, "dir1")).on(
				"initial-missing",
				() => {
					initialMissing = true;
				}
			);
			testHelper.tick(function() {
				for (const [, w] of wm.directoryWatchers) {
					w.close();
				}
				initialMissing.should.be.eql(false);
				done();
			});
		});
	});

	if (!IS_OSX) {
	it("should detect removed directory", function(done) {
		testHelper.dir("watch-test-dir");
		testHelper.tick(() => {
			var d = new DirectoryWatcher(path.join(fixtures, "watch-test-dir"), {});
			let gotDirectoryRemoved = false;
			
			d.on("change", (filePath, mtime, type) => {
				console.log(">>> change: ", filePath, mtime, type)
				if (type && type.includes("directory-removed")) {
					gotDirectoryRemoved = true;
				}
			});

			testHelper.tick(500, function() {
				testHelper.remove("watch-test-dir");
				testHelper.tick(3000, function() {
				if (gotDirectoryRemoved) {
					d.close();
					done();
				} else {
					d.close();
					done(new Error("Didn't receive a event about removed directory"));
				}
				});
			});
		});
	});
	}

	if (!+process.env.WATCHPACK_POLLING) {
		it("should log errors emitted from watcher to stderr", function(done) {
			var error_logged = false;
			var old_stderr = process.stderr.write;
			process.stderr.write = function(a) {
				error_logged = true;
			};
			var d = new DirectoryWatcher(fixtures, {});
			var a = d.watch(path.join(fixtures, "a"));
			d.watcher.emit("error", "error_message");

			testHelper.tick(function() {
				a.close();
				process.stderr.write = old_stderr;
				error_logged.should.be.true();
				done();
			});
		});
	}
});
