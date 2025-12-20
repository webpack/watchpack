"use strict";

const path = require("path");
const Watchpack = require("../lib");
const TestHelper = require("./helpers/TestHelper");

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

jest.setTimeout(10000);

if (fsIsCaseInsensitive) {
	describe("Casing", () => {
		beforeEach(testHelper.before);

		afterEach(testHelper.after);

		it("should watch a file with the wrong casing", (done) => {
			const w = new Watchpack({
				aggregateTimeout: 1000,
			});
			let changeEvents = 0;
			w.on("change", (file) => {
				expect(file).toBe(path.join(fixtures, "a"));
				changeEvents++;
			});
			w.on("aggregated", (changes) => {
				expect([...changes]).toEqual([path.join(fixtures, "a")]);
				expect(changeEvents).toBeGreaterThan(0);
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
						expect(true).toBe(false);
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

				expect(changes).toContain(path.join(fixtures, testFileRename));
				expect(removals).not.toContain(path.join(fixtures, testFileRename));

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
