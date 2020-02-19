/*globals describe it beforeEach afterEach */
"use strict";

require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

var fsIsCaseInsensitive;
try {
	fsIsCaseInsensitive = require("fs").existsSync(
		path.join(__dirname, "..", "PACKAGE.JSON")
	);
} catch (e) {
	fsIsCaseInsensitive = false;
}

if (fsIsCaseInsensitive) {
	describe("Casing", function() {
		this.timeout(10000);
		beforeEach(testHelper.before);
		afterEach(testHelper.after);

		it("should watch a file with the wrong casing", function(done) {
			var w = new Watchpack({
				aggregateTimeout: 1000
			});
			var changeEvents = 0;
			w.on("change", function(file) {
				file.should.be.eql(path.join(fixtures, "a"));
				changeEvents++;
			});
			w.on("aggregated", function(changes) {
				Array.from(changes).should.be.eql([path.join(fixtures, "a")]);
				changeEvents.should.be.greaterThan(0);
				w.close();
				done();
			});
			w.watch([path.join(fixtures, "a")], []);
			testHelper.tick(function() {
				testHelper.file("A");
			});
		});

		it("should mark as missing on changing filename casing (dir watch)", function(done) {
			var w = new Watchpack({
				aggregateTimeout: 1000
			});
			var dir = "case-rename";
			var testFile = path.join(dir, "hello.txt");
			var testFileRename = path.join(dir, "hEllO.txt");
			testHelper.dir(dir);
			testHelper.file(testFile);

			w.on("aggregated", function(changes, removals) {
				const files = w.getTimeInfoEntries();
				w.close();

				changes.has(path.join(fixtures, dir)).should.be.eql(true);

				for (const file of files.keys()) {
					if (file.endsWith("hello.txt")) {
						return done(new Error(`Renamed file was still in timeInfoEntries`));
					}
				}
				return done();
			});

			testHelper.tick(function() {
				w.watch([], [path.join(fixtures, "case-rename")]);

				testHelper.tick(function() {
					testHelper.rename(testFile, testFileRename);
				});
			});
		});

		it("should mark as missing on changing filename casing (file watch)", function(done) {
			var w = new Watchpack({
				aggregateTimeout: 1000
			});
			var dir = "case-rename";
			var testFile = path.join(dir, "hello.txt");
			var testFileRename = path.join(dir, "hEllO.txt");
			testHelper.dir(dir);
			testHelper.file(testFile);

			w.on("aggregated", function(changes, removals) {
				const files = w.getTimeInfoEntries();
				w.close();

				changes.has(path.join(fixtures, testFileRename)).should.be.eql(true);
				removals.has(path.join(fixtures, testFileRename)).should.be.eql(false);

				for (const file of files.keys()) {
					if (file.endsWith("hello.txt") && files.get(file)) {
						return done(new Error(`Renamed file was still in timeInfoEntries`));
					}
				}
				return done();
			});

			testHelper.tick(function() {
				w.watch({
					files: [path.join(fixtures, testFile)],
					missing: [path.join(fixtures, testFileRename)]
				});

				testHelper.tick(function() {
					testHelper.rename(testFile, testFileRename);
				});
			});
		});
	});
}
