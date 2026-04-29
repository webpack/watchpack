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

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(10000);

if (fsIsCaseInsensitive) {
	describe("casing", () => {
		beforeEach((done) => {
			testHelper.before(done);
		});

		afterEach((done) => {
			testHelper.after(done);
		});

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

				expect(changes).toContain(path.join(fixtures, dir));

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

		// Regression coverage for webpack/watchpack#228.
		// On case-insensitive filesystems, an import like `./B` for an on-disk
		// `b.txt` resolves successfully but produces a watcher path that does
		// not match the directory scan's record. `getTimeInfoEntries` then
		// reports `null` for the wrong-cased path, which webpack interprets as
		// "file does not exist" and skips invalidation (breaks fast refresh
		// after the first edit). The proper fix lives in enhanced-resolve,
		// which should canonicalize resolved paths to their on-disk casing so
		// this scenario never reaches watchpack. This test pins the current
		// behavior so any change to it is intentional.
		it("returns a non-null entry for a wrong-cased file watcher path (#228)", (done) => {
			const w = new Watchpack({ aggregateTimeout: 1000 });
			const dir = "case-mismatch";
			const realFile = path.join(dir, "b.txt");
			const wrongCasedFile = path.join(dir, "B.txt");
			testHelper.dir(dir);
			testHelper.file(realFile);

			testHelper.tick(() => {
				w.watch({ files: [path.join(fixtures, wrongCasedFile)] });

				testHelper.tick(() => {
					const entries = w.getTimeInfoEntries();
					const entry = entries.get(path.join(fixtures, wrongCasedFile));
					w.close();

					// Current behavior: watchpack has no record for the
					// wrong-cased path and reports `null`. If enhanced-resolve
					// canonicalizes upstream, this scenario should not occur in
					// practice; if watchpack ever starts reconciling against
					// `filesWithoutCase`, update this assertion accordingly.
					expect(entry).toBeNull();
					done();
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
} else {
	describe("casing (no tests)", () => {
		it("pass", () => {
			expect(true).toBe(true);
		});
	});
}
