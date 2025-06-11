/* globals describe it beforeEach afterEach */
"use strict";

require("should");

const path = require("path");
const TestHelper = require("./helpers/TestHelper");
const Watchpack = require("../lib/watchpack");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

let fsIsCaseInsensitive;
try {
	fsIsCaseInsensitive = require("fs").existsSync(
		path.join(__dirname, "..", "PACKAGE.JSON"),
	);
} catch (_err) {
	fsIsCaseInsensitive = false;
}

if (fsIsCaseInsensitive) {
	describe("Casing", function casingTest() {
		this.timeout(10000);
		beforeEach(testHelper.before);
		afterEach(testHelper.after);

		it("should watch a file with the wrong casing", (done) => {
			const w = new Watchpack({
				aggregateTimeout: 1000,
			});
			let changeEvents = 0;
			w.on("change", (file) => {
				file.should.be.eql(path.join(fixtures, "a"));
				changeEvents++;
			});
			w.on("aggregated", (changes) => {
				[...changes].should.be.eql([path.join(fixtures, "a")]);
				changeEvents.should.be.greaterThan(0);
				w.close();
				done();
			});
			w.watch([path.join(fixtures, "a")], []);
			testHelper.tick(() => {
				testHelper.file("A");
			});
		});

		it("should mark as missing on changing filename casing (dir watch)", (done) => {
			const w = new Watchpack({
				aggregateTimeout: 1000,
			});
			const dir = "case-rename";
			const testFile = path.join(dir, "hello.txt");
			const testFileRename = path.join(dir, "hEllO.txt");
			testHelper.dir(dir);
			testHelper.file(testFile);

			w.on("aggregated", (changes, _removals) => {
				const files = w.getTimeInfoEntries();
				w.close();

				changes.has(path.join(fixtures, dir)).should.be.eql(true);

				for (const file of files.keys()) {
					if (file.endsWith("hello.txt")) {
						return done(new Error("Renamed file was still in timeInfoEntries"));
					}
				}
				return done();
			});

			testHelper.tick(() => {
				w.watch([], [path.join(fixtures, "case-rename")]);

				testHelper.tick(() => {
					testHelper.rename(testFile, testFileRename);
				});
			});
		});

		it("should mark as missing on changing filename casing (file watch)", (done) => {
			const w = new Watchpack({
				aggregateTimeout: 1000,
			});
			const dir = "case-rename";
			const testFile = path.join(dir, "hello.txt");
			const testFileRename = path.join(dir, "hEllO.txt");
			testHelper.dir(dir);
			testHelper.file(testFile);

			w.on("aggregated", (changes, removals) => {
				const files = w.getTimeInfoEntries();
				w.close();

				changes.has(path.join(fixtures, testFileRename)).should.be.eql(true);
				removals.has(path.join(fixtures, testFileRename)).should.be.eql(false);

				for (const file of files.keys()) {
					if (file.endsWith("hello.txt") && files.get(file)) {
						return done(new Error("Renamed file was still in timeInfoEntries"));
					}
				}
				return done();
			});

			testHelper.tick(() => {
				w.watch({
					files: [path.join(fixtures, testFile)],
					missing: [path.join(fixtures, testFileRename)],
				});

				testHelper.tick(() => {
					testHelper.rename(testFile, testFileRename);
				});
			});
		});
	});
}
