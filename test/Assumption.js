/*globals describe it beforeEach afterEach */
require("should");
var path = require("path");
var fs = require("fs");
var chokidar = require("chokidar");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("Assumption", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should have a file system with correct mtime behavior", function(done) {
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
				afterMeassure();
			} else {
				testHelper.tick(100, checkMtime);
			}
		});

		function afterMeassure() {
			console.log("mtime accuracy (before): [" + minDiffBefore + " ; " + maxDiffBefore + "] avg " + Math.round(sumDiffBefore / count));
			console.log("mtime accuracy (after): [" + minDiffAfter + " ; " + maxDiffAfter + "] avg " + Math.round(sumDiffAfter / count));
			minDiffBefore.should.be.aboveOrEqual(-2000);
			maxDiffBefore.should.be.below(2000);
			minDiffAfter.should.be.aboveOrEqual(-2000);
			maxDiffAfter.should.be.below(2000);
			done();
		}
	});

	it("should fire events not after start", function(done) {
		testHelper.dir("watch-test-directory");
		testHelper.file("watch-test-file");
		var watcher = chokidar.watch(fixtures, {
			ignoreInitial: true,
			persistent: true,
			followSymlinks: false,
			depth: 0,
			atomic: false,
			alwaysStat: true,
			ignorePermissionErrors: true
		});
		watcher.on("add", function(arg) {
			done(new Error("should not be emitted " + arg));
			done = function() {};
		});
		watcher.on("change", function(arg) {
			done(new Error("should not be emitted " + arg));
			done = function() {};
		});
		watcher.on("error", function(err) {
			done(err);
			done = function() {};
		});
		testHelper.tick(500, function() {
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.tick(500, function() {
				watcher.close();
				done();
			});
		});
	})
});

