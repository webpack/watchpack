/*globals describe it beforeEach afterEach */
"use strict";

require("should");
var path = require("path");
var fs = require("fs");
var TestHelper = require("./helpers/TestHelper");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("Assumption", function() {
	this.timeout(10000);
	var watcherToClose = null;

	beforeEach(testHelper.before);
	afterEach(function(done) {
		if(watcherToClose) {
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
			if(diffBefore < minDiffBefore) minDiffBefore = diffBefore;
			if(diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
			sumDiffBefore += diffBefore;
			var diffAfter = +s.mtime - after;
			if(diffAfter < minDiffAfter) minDiffAfter = diffAfter;
			if(diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
			sumDiffAfter += diffAfter;
			if(i-- === 0) {
				afterMeasure();
			} else {
				testHelper.tick(100, checkMtime);
			}
		});

		function afterMeasure() {
			console.log("mtime stats accuracy (before): [" + minDiffBefore + " ; " + maxDiffBefore + "] avg " + Math.round(sumDiffBefore / count));
			console.log("mtime stats accuracy (after): [" + minDiffAfter + " ; " + maxDiffAfter + "] avg " + Math.round(sumDiffAfter / count));
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
		var watcher = watcherToClose = fs.watch(fixtures);
		testHelper.tick(100, function() {
			watcher.on("change", function(type, filename) {
				const s = fs.statSync(path.join(fixtures, filename));
				if(before && after) {
					var diffBefore = +s.mtime - before;
					if(diffBefore < minDiffBefore) minDiffBefore = diffBefore;
					if(diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
					sumDiffBefore += diffBefore;
					var diffAfter = +s.mtime - after;
					if(diffAfter < minDiffAfter) minDiffAfter = diffAfter;
					if(diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
					sumDiffAfter += diffAfter;
					before = after = undefined;
					if(i-- === 0) {
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
			console.log("mtime fs.watch accuracy (before): [" + minDiffBefore + " ; " + maxDiffBefore + "] avg " + Math.round(sumDiffBefore / count));
			console.log("mtime fs.watch accuracy (after): [" + minDiffAfter + " ; " + maxDiffAfter + "] avg " + Math.round(sumDiffAfter / count));
			minDiffBefore.should.be.aboveOrEqual(-2000);
			maxDiffBefore.should.be.below(2000);
			minDiffAfter.should.be.aboveOrEqual(-2000);
			maxDiffAfter.should.be.below(2000);
			done();
		}
	});

	it("should not fire events in subdirectories", function(done) {
		testHelper.dir("watch-test-directory");
		testHelper.tick(() => {
			var watcher = watcherToClose = fs.watch(fixtures);
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

	it("should rewatch removed directory", function(done) {
		testHelper.dir("watch-test-dir");
		testHelper.tick(() => {
			var watcher = watcherToClose = fs.watch(path.join(fixtures, "watch-test-dir"));
			watcher.on("change", function(arg, arg2) {
				console.log("change", arg, arg2);
			});
			watcher.on("error", function(err) {
				console.log("error", err);
			});
			testHelper.tick(500, function() {
				console.log("remove watched directory");
				testHelper.remove("watch-test-dir");
				testHelper.tick(500, function() {
					console.log("restore watched directory");
					testHelper.dir("watch-test-dir");
					testHelper.tick(500, function() {
						console.log("change file in watched directory");
						testHelper.file("watch-test-dir/watch-test-file");
						testHelper.tick(500, function() {
							done();
						});
					});
				});
			});
		});
	});

	[100, 200, 300, 500, 700, 1000].reverse().forEach(function(delay) {
		it("should fire events not after start and " + delay + "ms delay", function(done) {
			testHelper.file("watch-test-file-" + delay);
			testHelper.tick(delay, function() {
				var watcher = watcherToClose = fs.watch(fixtures);
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
