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

	it("should have a file system with correct mtime behavior (stats)", function(done) {
		this.timeout(20000);
		var i = 60;
		var count = 60;
		var minDiffBefore = +Infinity;
		var maxDiffBefore = -Infinity;
		var sumDiffBefore = 0;
		var minDiffAfter = +Infinity;
		var maxDiffAfter = -Infinity;
		var sumDiffAfter = 0;
		testHelper.tick(100, function checkMtime() {
			var before = Date.now();
			testHelper.file("a");
			var after = Date.now();
			var s = fs.statSync(path.join(fixtures, "a"));
			var diffBefore = +s.mtime - before;
			if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
			if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
			sumDiffBefore += diffBefore;
			var diffAfter = +s.mtime - after;
			if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
			if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
			sumDiffAfter += diffAfter;
			if (i-- === 0) {
				afterMeasure();
			} else {
				testHelper.tick(100, checkMtime);
			}
		});

		function afterMeasure() {
			console.log(
				"mtime stats accuracy (before): [" +
					minDiffBefore +
					" ; " +
					maxDiffBefore +
					"] avg " +
					Math.round(sumDiffBefore / count)
			);
			console.log(
				"mtime stats accuracy (after): [" +
					minDiffAfter +
					" ; " +
					maxDiffAfter +
					"] avg " +
					Math.round(sumDiffAfter / count)
			);
			minDiffBefore.should.be.aboveOrEqual(-2000);
			maxDiffBefore.should.be.below(2000);
			minDiffAfter.should.be.aboveOrEqual(-2000);
			maxDiffAfter.should.be.below(2000);
			done();
		}
	});

	it("should have a file system with correct mtime behavior (fs.watch)", function(done) {
		this.timeout(20000);
		testHelper.file("a");
		var i = 60;
		var count = 60;
		var before;
		var after;
		var minDiffBefore = +Infinity;
		var maxDiffBefore = -Infinity;
		var sumDiffBefore = 0;
		var minDiffAfter = +Infinity;
		var maxDiffAfter = -Infinity;
		var sumDiffAfter = 0;
		var watcher = (watcherToClose = fs.watch(fixtures));
		testHelper.tick(100, function() {
			watcher.on("change", function(type, filename) {
				const s = fs.statSync(path.join(fixtures, filename));
				if (before && after) {
					var diffBefore = +s.mtime - before;
					if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
					if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
					sumDiffBefore += diffBefore;
					var diffAfter = +s.mtime - after;
					if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
					if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
					sumDiffAfter += diffAfter;
					before = after = undefined;
					if (i-- === 0) {
						afterMeasure();
					} else {
						testHelper.tick(100, checkMtime);
					}
				}
			});
			testHelper.tick(100, checkMtime);
		});

		function checkMtime() {
			before = Date.now();
			testHelper.file("a");
			after = Date.now();
		}

		function afterMeasure() {
			console.log(
				"mtime fs.watch accuracy (before): [" +
					minDiffBefore +
					" ; " +
					maxDiffBefore +
					"] avg " +
					Math.round(sumDiffBefore / count)
			);
			console.log(
				"mtime fs.watch accuracy (after): [" +
					minDiffAfter +
					" ; " +
					maxDiffAfter +
					"] avg " +
					Math.round(sumDiffAfter / count)
			);
			minDiffBefore.should.be.aboveOrEqual(-2000);
			maxDiffBefore.should.be.below(2000);
			minDiffAfter.should.be.aboveOrEqual(-2000);
			maxDiffAfter.should.be.below(2000);
			done();
		}
	});

	if (SUPPORTS_RECURSIVE_WATCHING) {
		it("should have a file system with correct mtime behavior (fs.watch recursive)", function(done) {
			this.timeout(20000);
			testHelper.file("a");
			var i = 60;
			var count = 60;
			var before;
			var after;
			var minDiffBefore = +Infinity;
			var maxDiffBefore = -Infinity;
			var sumDiffBefore = 0;
			var minDiffAfter = +Infinity;
			var maxDiffAfter = -Infinity;
			var sumDiffAfter = 0;
			var watcher = (watcherToClose = fs.watch(fixtures, { recursive: true }));
			testHelper.tick(100, function() {
				watcher.on("change", function(type, filename) {
					const s = fs.statSync(path.join(fixtures, filename));
					if (before && after) {
						var diffBefore = +s.mtime - before;
						if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
						if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
						sumDiffBefore += diffBefore;
						var diffAfter = +s.mtime - after;
						if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
						if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
						sumDiffAfter += diffAfter;
						before = after = undefined;
						if (i-- === 0) {
							afterMeasure();
						} else {
							testHelper.tick(100, checkMtime);
						}
					}
				});
				testHelper.tick(100, checkMtime);
			});

			function checkMtime() {
				before = Date.now();
				testHelper.file("a");
				after = Date.now();
			}

			function afterMeasure() {
				console.log(
					"mtime fs.watch({ recursive: true }) accuracy (before): [" +
						minDiffBefore +
						" ; " +
						maxDiffBefore +
						"] avg " +
						Math.round(sumDiffBefore / count)
				);
				console.log(
					"mtime fs.watch({ recursive: true }) accuracy (after): [" +
						minDiffAfter +
						" ; " +
						maxDiffAfter +
						"] avg " +
						Math.round(sumDiffAfter / count)
				);
				minDiffBefore.should.be.aboveOrEqual(-2000);
				maxDiffBefore.should.be.below(2000);
				minDiffAfter.should.be.aboveOrEqual(-2000);
				maxDiffAfter.should.be.below(2000);
				done();
			}
		});
	}

	it("should not fire events in subdirectories", function(done) {
		testHelper.dir("watch-test-directory");
		testHelper.tick(500, () => {
			var watcher = (watcherToClose = fs.watch(fixtures));
			watcher.on("change", function(arg, arg2) {
				done(new Error("should not be emitted " + arg + " " + arg2));
				done = function() {};
			});
			watcher.on("error", function(err) {
				done(err);
				done = function() {};
			});
			testHelper.tick(500, function() {
				testHelper.file("watch-test-directory/watch-test-file");
				testHelper.tick(500, function() {
					done();
				});
			});
		});
	});

	if (SUPPORTS_RECURSIVE_WATCHING) {
		it("should fire events in subdirectories (recursive)", function(done) {
			testHelper.dir("watch-test-directory");
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.file("watch-test-directory/existing-file");
			testHelper.tick(500, () => {
				var watcher = (watcherToClose = fs.watch(fixtures, {
					recursive: true
				}));
				const events = [];
				watcher.once("change", () => {
					testHelper.tick(1000, function() {
						events.should.matchAny(/watch-test-directory[/\\]watch-test-file/);
						done();
					});
				});
				watcher.on("change", function(type, filename) {
					events.push(filename);
				});
				watcher.on("error", function(err) {
					done(err);
					done = function() {};
				});
				testHelper.tick(500, function() {
					testHelper.file("watch-test-directory/watch-test-file");
				});
			});
		});

		it("should allow to create/close/create recursive watchers", function(done) {
			testHelper.dir("watch-test-directory");
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.file("watch-test-directory/existing-file");
			testHelper.tick(500, () => {
				watcherToClose = fs.watch(fixtures, {
					recursive: true
				});
				watcherToClose.close();
				watcherToClose = fs.watch(fixtures, {
					recursive: true
				});
				watcherToClose.close();
				watcherToClose = fs.watch(fixtures, {
					recursive: true
				});
				watcherToClose.close();
				var watcher = (watcherToClose = fs.watch(fixtures, {
					recursive: true
				}));
				const events = [];
				watcher.once("change", () => {
					testHelper.tick(1000, function() {
						events.should.matchAny(/watch-test-directory[/\\]watch-test-file/);
						done();
					});
				});
				watcher.on("change", function(type, filename) {
					events.push(filename);
				});
				watcher.on("error", function(err) {
					done(err);
					done = function() {};
				});
				testHelper.tick(500, function() {
					testHelper.file("watch-test-directory/watch-test-file");
				});
			});
		});
	}

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
					if (type === "rename" && filename === "watch-test-dir")
						gotSelfRename = true;
				});
				watcher.on("error", function(err) {
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

	[100, 200, 300, 500, 700, 1000].reverse().forEach(function(delay) {
		it("should fire events not after start and " + delay + "ms delay", function(
			done
		) {
			testHelper.file("watch-test-file-" + delay);
			testHelper.tick(delay, function() {
				var watcher = (watcherToClose = fs.watch(fixtures));
				watcher.on("change", function(arg) {
					done(new Error("should not be emitted " + arg));
					done = function() {};
				});
				watcher.on("error", function(err) {
					done(err);
					done = function() {};
				});
				testHelper.tick(500, function() {
					done();
				});
			});
		});
	});
});
