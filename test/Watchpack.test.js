"use strict";

const path = require("path");
const WatchpackTest = require("../lib");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

/** @typedef {import("../lib/index").Entry} Entry */
/** @typedef {import("../lib/index").Changes} Changes */

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(10000);

describe("Watchpack", () => {
	beforeEach((done) => {
		testHelper.before(done);
	});

	afterEach((done) => {
		testHelper.after(done);
	});

	it("should watch a single file", (done) => {
		const w = new WatchpackTest({
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
			testHelper.file("a");
		});
	});

	it("should aggregate changes while paused", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		testHelper.file("a");
		testHelper.file("b");
		w.watch([path.join(fixtures, "a"), path.join(fixtures, "b")], []);
		testHelper.tick(() => {
			w.pause();
			w.on("change", (_file) => {
				throw new Error("should not be emitted");
			});
			w.on("aggregated", (_changes) => {
				throw new Error("should not be emitted");
			});
			testHelper.tick(() => {
				testHelper.file("a");
				testHelper.remove("b");
				testHelper.file("b");
				testHelper.remove("a");
				testHelper.tick(() => {
					const { changes, removals } = w.getAggregated();
					expect([...changes]).toEqual([path.join(fixtures, "b")]);
					expect([...removals]).toEqual([path.join(fixtures, "a")]);
					w.close();
					done();
				});
			});
		});
	});

	it("should not watch a single ignored file (glob)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 300,
			ignored: "**/a",
		});
		let changeEvents = 0;
		let aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		w.watch([path.join(fixtures, "a")], []);
		testHelper.tick(() => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				expect(changeEvents).toBe(0);
				expect(aggregatedEvents).toBe(0);
				expect(testHelper.getNumberOfWatchers()).toBe(0);
				w.close();
				done();
			});
		});
	});

	it("should not watch a single ignored file (regexp)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 300,
			ignored: /\/a$/,
		});
		let changeEvents = 0;
		let aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		w.watch([path.join(fixtures, "a")], []);
		testHelper.tick(() => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				expect(changeEvents).toBe(0);
				expect(aggregatedEvents).toBe(0);
				expect(testHelper.getNumberOfWatchers()).toBe(0);
				w.close();
				done();
			});
		});
	});

	it("should not watch a single ignored file (function)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 300,
			ignored: (entry) => entry.includes("a"),
		});
		let changeEvents = 0;
		let aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		w.watch([path.join(fixtures, "a")], []);
		testHelper.tick(() => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				expect(changeEvents).toBe(0);
				expect(aggregatedEvents).toBe(0);
				expect(testHelper.getNumberOfWatchers()).toBe(0);
				w.close();
				done();
			});
		});
	});

	it("should watch multiple files", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes].sort()).toEqual([
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
			]);
			expect(changeEvents).toEqual([
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
				path.join(fixtures, "a"),
			]);
			expect(Object.keys(w.getTimes()).sort()).toEqual([
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
			]);
			w.close();
			done();
		});
		w.watch([path.join(fixtures, "a"), path.join(fixtures, "b")], []);
		testHelper.tick(400, () => {
			testHelper.file("a");
			testHelper.tick(400, () => {
				testHelper.file("b");
				testHelper.tick(400, () => {
					testHelper.file("a");
					testHelper.tick(400, () => {
						testHelper.file("b");
						testHelper.tick(400, () => {
							testHelper.file("a");
						});
					});
				});
			});
		});
	});

	it("should watch a directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(200, () => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, () => {
				testHelper.file(path.join("dir", "a"));
			});
		});
	});

	it("should not watch an ignored directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 300,
			ignored: ["**/dir"],
		});
		let changeEvents = 0;
		let aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		testHelper.dir("dir");
		testHelper.tick(200, () => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, () => {
				testHelper.file(path.join("dir", "a"));
				testHelper.tick(1000, () => {
					expect(changeEvents).toBe(0);
					expect(aggregatedEvents).toBe(0);
					expect(testHelper.getNumberOfWatchers()).toBe(0);
					w.close();
					done();
				});
			});
		});
	});

	it("should not watch an ignored file in a directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 300,
			ignored: ["**/a"],
		});
		let changeEvents = 0;
		let aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		testHelper.dir("dir");
		testHelper.tick(200, () => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, () => {
				testHelper.file(path.join("dir", "a"));
				testHelper.tick(1000, () => {
					expect(changeEvents).toBe(0);
					expect(aggregatedEvents).toBe(0);
					w.close();
					done();
				});
			});
		});
	});

	it("should watch a file when ignore is empty array", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
			ignored: [],
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
			testHelper.file("a");
		});
	});

	it("should watch a file when ignore is an array with empty string", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
			ignored: ["", ""],
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
			testHelper.file("a");
		});
	});

	it("should watch a file when ignore is empty string", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
			ignored: "",
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
			testHelper.file("a");
		});
	});

	it("should watch a file then a directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes, removals) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect([...removals]).toEqual([]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "subdir"));
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(400, () => {
			w.watch([path.join(fixtures, "dir", "a")], []);
			testHelper.tick(() => {
				w.watch([], [path.join(fixtures, "dir")]);
				testHelper.tick(() => {
					testHelper.file(path.join("dir", "a"));
				});
			});
		});
	});

	it("should watch a directory (delete file)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(() => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.remove(path.join("dir", "a"));
			});
		});
	});

	it("should watch a directory (delete and recreate file)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([
				path.join(fixtures, "dir", "a"),
				path.join(fixtures, "dir", "b"),
				path.join(fixtures, "dir", "a"),
			]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(() => {
			w.watch([], [path.join(fixtures, "dir")]);
			// Windows' ReadDirectoryChangesW can reorder rapid events, so give
			// each operation enough separation that the watcher observes them
			// in source order and we exit the initial scan before the first
			// change.
			testHelper.tick(500, () => {
				testHelper.remove(path.join("dir", "a"));
				testHelper.tick(500, () => {
					testHelper.file(path.join("dir", "b"));
					testHelper.tick(500, () => {
						testHelper.file(path.join("dir", "a"));
					});
				});
			});
		});
	});

	it("should watch a missing directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir", "sub")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(() => {
			w.watch({ missing: [path.join(fixtures, "dir", "sub")] });
			testHelper.tick(() => {
				testHelper.dir(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (add directory)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(() => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.dir(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (delete directory)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.file(path.join("dir", "sub", "a"));
		testHelper.tick(() => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.remove(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (delete, restore and change directory)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes, removals) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir", "sub", "a")]);
			expect([...removals]).toEqual([]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.file(path.join("dir", "sub", "a"));
		testHelper.tick(() => {
			w.watch([path.join(fixtures, "dir", "sub", "a")], []);
			testHelper.tick(() => {
				testHelper.remove(path.join("dir", "sub"));
				testHelper.tick(() => {
					testHelper.dir(path.join("dir", "sub"));
					testHelper.file(path.join("dir", "sub", "a"));
				});
			});
		});
	});

	it("should watch a directory (delete directory2)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.tick(() => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.remove(path.join("dir", "sub"));
			});
		});
	});

	it("should watch already watched directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(400, () => {
			w.watch([path.join(fixtures, "dir", "a")], []);
			testHelper.tick(1000, () => {
				w.watch([], [path.join(fixtures, "dir")]);
				testHelper.tick(400, () => {
					testHelper.remove(path.join("dir", "a"));
				});
			});
		});
	});

	it("should watch file in a sub directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "sub", "a")]);
			const times = w.getTimeInfoEntries();
			const dir = /** @type {Entry} */ (times.get(path.join(fixtures, "dir")));
			const sub =
				/** @type {Entry} */
				(times.get(path.join(fixtures, "dir", "sub")));
			const a =
				/** @type {Entry} */
				(times.get(path.join(fixtures, "dir", "sub", "a")));
			expect(typeof dir).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(dir, "safeTime")).toBe(true);
			expect(sub.safeTime).toBeGreaterThanOrEqual(a.safeTime);
			expect(dir.safeTime).toBeGreaterThanOrEqual(sub.safeTime);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.tick(() => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.file(path.join("dir", "sub", "a"));
			});
		});
	});

	it("should watch file in a sub directory (passed in maps)", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "sub", "a")]);
			const files = new Map();
			const directories = new Map();
			w.collectTimeInfoEntries(files, directories);
			const dir = directories.get(path.join(fixtures, "dir"));
			const dirAsFile = files.get(path.join(fixtures, "dir"));
			const sub = directories.get(path.join(fixtures, "dir", "sub"));
			const subAsFile = files.get(path.join(fixtures, "dir", "sub"));
			const a = files.get(path.join(fixtures, "dir", "sub", "a"));
			const file = files.get(path.join(fixtures, "file"));
			expect(typeof dir).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(dir, "safeTime")).toBe(true);
			expect(typeof dirAsFile).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(dirAsFile, "safeTime")).toBe(
				false,
			);
			expect(typeof sub).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(sub, "safeTime")).toBe(true);
			expect(typeof subAsFile).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(subAsFile, "safeTime")).toBe(
				false,
			);
			expect(typeof a).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(a, "safeTime")).toBe(true);
			expect(Object.prototype.hasOwnProperty.call(a, "timestamp")).toBe(true);
			expect(file).toBeNull();
			expect(sub.safeTime).toBeGreaterThanOrEqual(a.safeTime);
			expect(dir.safeTime).toBeGreaterThanOrEqual(sub.safeTime);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.dir(path.join("dir", "sub2"));
		testHelper.tick(() => {
			w.watch([path.join(fixtures, "file")], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.file(path.join("dir", "sub", "a"));
			});
		});
	});

	it("should watch directory as file and directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		w.on("aggregated", (_changes) => {
			const files = new Map();
			const directories = new Map();
			w.collectTimeInfoEntries(files, directories);
			// fixtures should exist
			const fixturesAsFile = files.get(path.join(fixtures));
			expect(typeof fixturesAsFile).toBe("object");
			// dir should exist
			const dirAsFile = files.get(path.join(fixtures, "dir"));
			expect(typeof dirAsFile).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(dirAsFile, "safeTime")).toBe(
				false,
			);
			// a should have timestamp
			const a = files.get(path.join(fixtures, "dir", "sub", "a"));
			expect(typeof a).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(a, "safeTime")).toBe(true);
			expect(Object.prototype.hasOwnProperty.call(a, "timestamp")).toBe(true);
			// sub should have timestamp
			const sub = directories.get(path.join(fixtures, "dir", "sub"));
			expect(typeof sub).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(sub, "safeTime")).toBe(true);
			// sub should exist as file
			const subAsFile = files.get(path.join(fixtures, "dir", "sub"));
			expect(typeof subAsFile).toBe("object");
			expect(Object.prototype.hasOwnProperty.call(subAsFile, "safeTime")).toBe(
				false,
			);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.dir(path.join("dir", "sub2"));
		testHelper.tick(() => {
			w.watch(
				[
					path.join(fixtures, "dir", "sub", "a"),
					path.join(fixtures, "dir", "sub"),
					path.join(fixtures),
				],
				[path.join(fixtures, "dir", "sub")],
			);
			testHelper.tick(() => {
				testHelper.file(path.join("dir", "sub", "a"));
			});
		});
	});

	it("should watch 2 files in a not-existing directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		w.on("aggregated", (changes) => {
			expect([...changes].sort()).toEqual([
				path.join(fixtures, "dir", "sub", "a"),
				path.join(fixtures, "dir", "sub", "b"),
			]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		w.watch(
			[
				path.join(fixtures, "dir", "sub", "a"),
				path.join(fixtures, "dir", "sub", "b"),
			],
			[],
		);
		testHelper.tick(() => {
			testHelper.dir(path.join("dir", "sub"));
			testHelper.file(path.join("dir", "sub", "a"));
			testHelper.file(path.join("dir", "sub", "b"));
		});
	});

	it("should watch file in a sub sub directory", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([
				path.join(fixtures, "dir", "sub", "sub", "a"),
			]);
			expect(Object.keys(w.getTimes()).sort()).toEqual([
				path.join(fixtures, "dir"),
				path.join(fixtures, "dir", "sub"),
				path.join(fixtures, "dir", "sub", "sub"),
				path.join(fixtures, "dir", "sub", "sub", "a"),
			]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.dir(path.join("dir", "sub", "sub"));
		testHelper.tick(2000, () => {
			w.watch([], [path.join(fixtures, "dir")], Date.now());
			testHelper.tick(() => {
				testHelper.file(path.join("dir", "sub", "sub", "a"));
			});
		});
	});

	it("should watch file in a directory that contains special glob characters", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		/** @type {string[]} */
		const changeEvents = [];
		w.on("change", (file) => {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "dir")]);
			expect(changeEvents).toEqual([path.join(fixtures, "dir", "sub()", "a")]);
			const times = w.getTimeInfoEntries();
			const dir = /** @type {Entry} */ (times.get(path.join(fixtures, "dir")));
			const sub =
				/** @type {Entry} */
				(times.get(path.join(fixtures, "dir", "sub()")));
			const a =
				/** @type {Entry} */
				(times.get(path.join(fixtures, "dir", "sub()", "a")));
			expect(sub.safeTime).toBeGreaterThanOrEqual(a.safeTime);
			expect(dir.safeTime).toBeGreaterThanOrEqual(sub.safeTime);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub()"));
		testHelper.tick(2000, () => {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(() => {
				testHelper.file(path.join("dir", "sub()", "a"));
			});
		});
	});

	it("should detect a single change to future timestamps", (done) => {
		const options = {
			aggregateTimeout: 1000,
		};
		const w = new WatchpackTest(options);
		const w2 = new WatchpackTest(options);
		w.on("change", () => {
			throw new Error("should not report change event");
		});
		w.on("aggregated", () => {
			throw new Error("should not report aggregated event");
		});
		testHelper.file("a");
		testHelper.tick(400, () => {
			w2.watch([path.join(fixtures, "a")], [], Date.now());
			testHelper.tick(1000, () => {
				// wait for initial scan
				testHelper.mtime("a", Date.now() + 1000000);
				testHelper.tick(400, () => {
					w.watch([path.join(fixtures, "a")], [], Date.now());
					testHelper.tick(1000, () => {
						expect(true).toBe(true);
						w2.close();
						w.close();
						done();
					});
				});
			});
		});
	});

	it("should create different watchers for different options", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		const w2 = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		testHelper.file("a");
		testHelper.tick(400, () => {
			w.watch([path.join(fixtures, "a")], [], Date.now());
			w2.watch([path.join(fixtures, "a")], [], Date.now());
			testHelper.tick(1000, () => {
				testHelper.file("a");
				testHelper.tick(400, () => {
					testHelper.file("a");
					testHelper.tick(1000, () => {
						expect(true).toBe(true);
						w2.close();
						w.close();
						done();
					});
				});
			});
		});
	});

	it("should detect a past change to a file (timestamp)", (done) => {
		const w = new WatchpackTest({
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
		const startTime = Date.now();
		testHelper.tick(() => {
			testHelper.file("a");
			testHelper.tick(() => {
				w.watch([path.join(fixtures, "a")], [], startTime);
			});
		});
	});

	it("should not detect a past change to a file (watched)", (done) => {
		const w2 = new WatchpackTest();
		const w = new WatchpackTest();
		w.on("change", () => {
			throw new Error("Should not be detected");
		});
		testHelper.tick(() => {
			testHelper.file("b");
			w2.watch([path.join(fixtures, "b")], []);
			testHelper.tick(1000, () => {
				// wait for stable state
				testHelper.file("a");
				testHelper.tick(1000, () => {
					const startTime = Date.now();
					testHelper.tick(400, () => {
						w.watch([path.join(fixtures, "a")], [], startTime);
						testHelper.tick(1000, () => {
							expect(true).toBe(true);
							w.close();
							w2.close();
							done();
						});
					});
				});
			});
		});
	});

	it("should detect a past change to a file (watched)", (done) => {
		const w2 = new WatchpackTest();
		const w = new WatchpackTest();
		let changeEvents = 0;
		w.on("change", (file) => {
			expect(file).toBe(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", (changes) => {
			expect([...changes]).toEqual([path.join(fixtures, "a")]);
			expect(changeEvents).toBe(1);
			w.close();
			w2.close();
			done();
		});
		testHelper.tick(() => {
			testHelper.file("b");
			w2.watch([path.join(fixtures, "b")], []);
			testHelper.tick(() => {
				const startTime = Date.now();
				testHelper.tick(() => {
					testHelper.file("a");
					testHelper.tick(400, () => {
						w.watch([path.join(fixtures, "a")], [], startTime);
					});
				});
			});
		});
	});

	it("should watch a single file removal", (done) => {
		testHelper.file("a");
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		let removeEvents = 0;
		w.on("remove", (file) => {
			expect(file).toBe(path.join(fixtures, "a"));
			removeEvents++;
		});
		w.on("aggregated", (changes, removals) => {
			expect([...removals]).toEqual([path.join(fixtures, "a")]);
			expect(removeEvents).toBe(1);
			w.close();
			done();
		});
		testHelper.tick(400, () => {
			w.watch([path.join(fixtures, "a")], []);
			testHelper.tick(() => {
				testHelper.remove("a");
			});
		});
	});

	it("should watch multiple file removals", (done) => {
		let step = 0;
		testHelper.file("a");
		testHelper.file("b");
		const w = new WatchpackTest({
			aggregateTimeout: 3000,
		});
		/** @type {string[]} */
		const removeEvents = [];
		w.on("remove", (file) => {
			if (removeEvents[removeEvents.length - 1] === file) return;
			removeEvents.push(file);
		});
		w.on("aggregated", (changes, removals) => {
			expect(step).toBe(6);
			expect([...removals].sort()).toEqual([
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
			]);
			// @ts-expect-error for testing
			if (!+process.env.WATCHPACK_POLLING) {
				expect(removeEvents).toEqual([
					path.join(fixtures, "a"),
					path.join(fixtures, "b"),
					path.join(fixtures, "a"),
					path.join(fixtures, "b"),
				]);
			}
			expect(Object.keys(w.getTimes()).sort()).toEqual([
				path.join(fixtures, "a"),
				path.join(fixtures, "b"),
			]);
			w.close();
			done();
		});
		testHelper.tick(400, () => {
			w.watch([path.join(fixtures, "a"), path.join(fixtures, "b")], []);
			step = 1;
			testHelper.tick(1000, () => {
				testHelper.remove("a");
				step = 2;
				testHelper.tick(() => {
					testHelper.remove("b");
					step = 3;
					testHelper.tick(1000, () => {
						testHelper.file("a");
						testHelper.file("b");
						step = 4;
						testHelper.tick(1000, () => {
							testHelper.remove("a");
							step = 5;
							testHelper.tick(() => {
								testHelper.remove("b");
								step = 6;
							});
						});
					});
				});
			});
		});
	});

	it("should not report changes in initial scan when no start time is provided", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 100,
		});
		w.on("aggregated", () => {
			done(new Error("should not fire"));
		});
		testHelper.dir("dir");
		testHelper.dir("dir/b");
		testHelper.dir("dir/b/sub");
		testHelper.file("dir/b/sub/file");
		testHelper.dir("dir/b/sub/sub");
		testHelper.file("dir/b/sub/sub/file");
		testHelper.file("dir/b/file");
		testHelper.file("dir/a");
		testHelper.tick(1000, () => {
			w.watch({
				directories: [path.join(fixtures, "dir", "b", "sub")],
			});
			testHelper.tick(2000, () => {
				// no event fired
				w.watch({
					files: [path.join(fixtures, "dir", "a")],
					directories: [
						path.join(fixtures, "dir", "b", "sub"),
						path.join(fixtures, "dir", "b"),
					],
					missing: [path.join(fixtures, "dir", "c")],
				});
				testHelper.tick(2000, () => {
					expect(true).toBe(true);
					// no event fired
					w.close();
					done();
				});
			});
		});
	});

	it("should not report changes in initial scan when start time is provided", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 100,
		});
		w.on("aggregated", () => {
			done(new Error("should not fire"));
		});
		testHelper.dir("dir");
		testHelper.dir("dir/b");
		testHelper.dir("dir/b/sub");
		testHelper.file("dir/b/sub/file");
		testHelper.dir("dir/b/sub/sub");
		testHelper.file("dir/b/sub/sub/file");
		testHelper.file("dir/b/file");
		testHelper.file("dir/a");
		testHelper.tick(1000, () => {
			w.watch({
				directories: [path.join(fixtures, "dir", "b", "sub")],
				startTime: Date.now(),
			});
			testHelper.tick(2000, () => {
				// no event fired
				w.watch({
					files: [path.join(fixtures, "dir", "a")],
					directories: [
						path.join(fixtures, "dir", "b", "sub"),
						path.join(fixtures, "dir", "b"),
					],
					missing: [path.join(fixtures, "dir", "c")],
					startTime: Date.now(),
				});
				testHelper.tick(2000, () => {
					expect(true).toBe(true);
					// no event fired
					w.close();
					done();
				});
			});
		});
	});

	it("should not report changes to a folder watched as file when items are added", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 100,
		});
		w.on("aggregated", () => {
			done(new Error("should not fire"));
		});
		testHelper.dir("dir");
		testHelper.file("dir/a");
		testHelper.tick(1000, () => {
			testHelper.file("dir/b");
			w.watch({
				files: [path.join(fixtures, "dir")],
				startTime: Date.now(),
			});
			testHelper.tick(1000, () => {
				testHelper.file("dir/c");
				testHelper.tick(1000, () => {
					expect(true).toBe(true);
					// no event fired
					w.close();
					done();
				});
			});
		});
	});

	it("should report removal of file and directory if it is missing in initial scan", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		w.on("aggregated", (changes, removals) => {
			expect([...changes]).toEqual([]);
			expect([...removals].sort()).toEqual([
				path.join(fixtures, "dir", "a"),
				path.join(fixtures, "dir", "b"),
			]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(() => {
			w.watch({
				files: [path.join(fixtures, "dir", "a")],
				directories: [path.join(fixtures, "dir", "b")],
				missing: [path.join(fixtures, "dir", "c")],
			});
		});
	});

	it("should report removal of file and directory if parent directory is missing in initial scan", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		w.on("aggregated", (changes, removals) => {
			expect([...changes]).toEqual([]);
			expect([...removals].sort()).toEqual([
				path.join(fixtures, "dir", "a"),
				path.join(fixtures, "dir", "b"),
			]);
			w.close();
			done();
		});
		testHelper.tick(() => {
			w.watch({
				files: [path.join(fixtures, "dir", "a")],
				directories: [path.join(fixtures, "dir", "b")],
				missing: [path.join(fixtures, "dir", "c")],
			});
		});
	});

	it("should not detect file reading as change, but atomic file writes", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		w.on("aggregated", (changes, removals) => {
			expect([...changes].sort()).toEqual([
				path.join(fixtures, "dir", "b"),
				path.join(fixtures, "dir", "c"),
			]);
			expect([...removals]).toEqual([]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.file(path.join("dir", "b"));
		testHelper.file(path.join("dir", "c"));
		testHelper.tick(1000, () => {
			w.watch({
				files: [
					path.join(fixtures, "dir", "a"),
					path.join(fixtures, "dir", "b"),
					path.join(fixtures, "dir", "c"),
				],
			});
			testHelper.tick(1000, () => {
				testHelper.accessFile(path.join("dir", "a"));
				testHelper.fileAtomic(path.join("dir", "b"));
				testHelper.file(path.join("dir", "c"));
			});
		});
	});

	it("should allow to reuse watchers when watch is called again", (done) => {
		const w = new WatchpackTest({
			aggregateTimeout: 1000,
		});
		w.on("aggregated", () => {
			expect(true).toBe(false);
			done(new Error("should not fire"));
		});
		testHelper.dir("dir");
		testHelper.dir("dir/b");
		testHelper.dir("dir/b/sub");
		testHelper.file("dir/b/sub/file");
		testHelper.file("dir/b/file");
		testHelper.dir("dir/b1");
		testHelper.dir("dir/b1/sub");
		testHelper.file("dir/b1/sub/file");
		testHelper.file("dir/b1/file");
		testHelper.dir("dir/b2");
		testHelper.dir("dir/b2/sub");
		testHelper.file("dir/b2/sub/file");
		testHelper.file("dir/b2/file");
		testHelper.file("dir/a");
		testHelper.file("dir/a1");
		testHelper.file("dir/a2");
		testHelper.tick(() => {
			w.watch({
				files: [
					path.join(fixtures, "dir", "a"),
					path.join(fixtures, "dir", "a1"),
				],
				directories: [
					path.join(fixtures, "dir", "b"),
					path.join(fixtures, "dir", "b1"),
				],
				missing: [
					path.join(fixtures, "dir", "c"),
					path.join(fixtures, "dir", "c1"),
				],
			});
			testHelper.tick(() => {
				w.watch({
					files: [
						path.join(fixtures, "dir", "a"),
						path.join(fixtures, "dir", "a2"),
					],
					directories: [
						path.join(fixtures, "dir", "b"),
						path.join(fixtures, "dir", "b2"),
					],
					missing: [
						path.join(fixtures, "dir", "c"),
						path.join(fixtures, "dir", "c2"),
					],
				});
				testHelper.file("dir/b1/sub/file");
				testHelper.file("dir/a1");
				testHelper.file("dir/c1");
				testHelper.tick(2000, () => {
					// no event fired
					w.close();
					done();
				});
			});
		});
	});

	let symlinksSupported = false;
	try {
		const fs = require("fs");

		fs.symlinkSync("helpers", path.join(__dirname, "fixtures"), "dir");
		fs.unlinkSync(path.join(__dirname, "fixtures"));
		symlinksSupported = true;
	} catch (_err) {
		// ignore
	}

	if (symlinksSupported) {
		describe("symlinks", () => {
			beforeEach((done) => {
				testHelper.dir("a");
				testHelper.dir(path.join("a", "b"));
				testHelper.file(path.join("a", "b", "c"));
				testHelper.file(path.join("a", "b", "d"));
				testHelper.symlinkDir("link", "a");
				testHelper.symlinkDir(path.join("a", "link"), "b");
				testHelper.symlinkFile(path.join("a", "b", "link"), "c");
				testHelper.symlinkFile(path.join("a", "b", "link2"), "link");
				testHelper.symlinkFile("link2", "link/link/link2");

				testHelper.tick(1000, done);
			});

			/**
			 * @param {string | string[]} files files
			 * @param {string | string[]} dirs dirs
			 * @param {(changes: Changes) => void} callback callback
			 * @param {() => void} ready ready callback
			 */
			function expectWatchEvent(files, dirs, callback, ready) {
				const w = new WatchpackTest({
					aggregateTimeout: 500,
					followSymlinks: true,
				});

				if (typeof files === "string") {
					files = [files];
				}

				if (typeof dirs === "string") {
					dirs = [dirs];
				}

				w.watch([...files], [...dirs], Date.now());

				let active = false;
				let closed = false;

				w.on("aggregated", (changes) => {
					w.close();
					closed = true;
					if (!active) throw new Error("Events are not expected yet");
					callback(changes);
				});

				testHelper.tick(1000, () => {
					if (closed) return;
					active = true;
					ready();
				});
			}

			it("should detect a change to the original file", (done) => {
				expectWatchEvent(
					path.join(fixtures, "link2"),
					[],
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link2")]);
						done();
					},
					() => {
						testHelper.file(path.join("a", "b", "c"));
					},
				);
			});

			it("should detect a change to the direct symlink", (done) => {
				expectWatchEvent(
					path.join(fixtures, "link2"),
					[],
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link2")]);
						done();
					},
					() => {
						testHelper.unlink("link2");
						testHelper.symlinkFile("link2", path.join("a", "b", "d"));
					},
				);
			});

			it("should detect a change to the double symlink", (done) => {
				expectWatchEvent(
					path.join(fixtures, "link2"),
					[],
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link2")]);
						done();
					},
					() => {
						testHelper.unlink(path.join("a", "b", "link2"));
						testHelper.symlinkFile(path.join("a", "b", "link2"), "d");
					},
				);
			});

			it("should detect a change to the directory symlink", (done) => {
				expectWatchEvent(
					path.join(fixtures, "link2"),
					[],
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link2")]);
						done();
					},
					() => {
						testHelper.unlink(path.join("a", "link"));
						testHelper.symlinkDir(path.join("a", "link"), path.join("b", "d"));
					},
				);
			});

			it("should detect a file change in a watched symlinked directory", (done) => {
				expectWatchEvent(
					[],
					path.join(fixtures, "link"),
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link")]);
						done();
					},
					() => {
						testHelper.file(path.join("a", "b", "c"));
					},
				);
			});

			it("should detect a symlink file change in a watched symlinked directory", (done) => {
				expectWatchEvent(
					[],
					path.join(fixtures, "link"),
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link")]);
						done();
					},
					() => {
						testHelper.unlink(path.join("a", "b", "link2"));
						testHelper.symlinkFile(path.join("a", "b", "link2"), "d");
					},
				);
			});

			it("should detect a symlink dir change in a watched symlinked directory", (done) => {
				expectWatchEvent(
					[],
					path.join(fixtures, "link"),
					(changes) => {
						expect([...changes]).toEqual([path.join(fixtures, "link")]);
						done();
					},
					() => {
						testHelper.unlink(path.join("a", "link"));
						testHelper.symlinkDir(path.join("a", "link"), path.join("b", "d"));
					},
				);
			});

			it("should detect a change to a symlink target file inside a watched real directory (#190)", (done) => {
				testHelper.file("ext_target");
				testHelper.symlinkFile(
					path.join("a", "b", "ext_link"),
					path.join("..", "..", "ext_target"),
				);
				testHelper.tick(2500, () => {
					expectWatchEvent(
						[],
						path.join(fixtures, "a", "b"),
						(changes) => {
							expect([...changes]).toEqual([path.join(fixtures, "a", "b")]);
							done();
						},
						() => {
							testHelper.file("ext_target");
						},
					);
				});
			});

			it("should detect a change inside a symlinked directory nested in a watched real directory (#190)", (done) => {
				testHelper.dir("ext_dir");
				testHelper.file(path.join("ext_dir", "inner"));
				testHelper.symlinkDir(
					path.join("a", "b", "ext_dir_link"),
					path.join("..", "..", "ext_dir"),
				);
				testHelper.tick(2500, () => {
					expectWatchEvent(
						[],
						path.join(fixtures, "a", "b"),
						(changes) => {
							expect([...changes]).toEqual([path.join(fixtures, "a", "b")]);
							done();
						},
						() => {
							testHelper.file(path.join("ext_dir", "inner"));
						},
					);
				});
			});

			it("should report the symlink path (not the resolved target) for files inside a symlinked directory (#231)", (done) => {
				testHelper.dir("ext_dir");
				testHelper.file(path.join("ext_dir", "inner"));
				testHelper.symlinkDir(
					path.join("a", "b", "ext_dir_link"),
					path.join("..", "..", "ext_dir"),
				);
				testHelper.tick(2500, () => {
					const w = new WatchpackTest({
						aggregateTimeout: 500,
						followSymlinks: true,
					});

					/** @type {string[]} */
					const fileChanges = [];
					w.on("change", (file) => {
						fileChanges.push(file);
					});

					w.watch([], [path.join(fixtures, "a", "b")], Date.now());

					testHelper.tick(1000, () => {
						testHelper.file(path.join("ext_dir", "inner"));
						testHelper.tick(2000, () => {
							const symlinkPath = path.join(
								fixtures,
								"a",
								"b",
								"ext_dir_link",
								"inner",
							);
							const resolvedPath = path.join(fixtures, "ext_dir", "inner");
							expect(fileChanges).toContain(symlinkPath);
							expect(fileChanges).not.toContain(resolvedPath);
							w.close();
							done();
						});
					});
				});
			});

			it("should not recurse infinitely when a symlinked directory points to one of its ancestors (#231 cycle guard)", (done) => {
				// fixtures/a/b/cycle is a symlink to ".." (i.e. fixtures/a). Without
				// a cycle guard, descent would walk a/b/cycle -> a/b/cycle/b ->
				// a/b/cycle/b/cycle -> ... creating an unbounded chain of watchers.
				testHelper.symlinkDir(path.join("a", "b", "cycle"), "..");
				testHelper.tick(500, () => {
					const w = new WatchpackTest({
						aggregateTimeout: 500,
						followSymlinks: true,
					});

					w.watch([], [path.join(fixtures, "a", "b")], Date.now());

					testHelper.tick(2000, () => {
						// With the guard the descent stops at the cycle, so the
						// `WatcherManager` only tracks a small, bounded number of
						// `DirectoryWatcher`s. Without it, every recursion level adds
						// a new entry and the size grows into the hundreds within
						// a couple of seconds (locally observed: 2500+ at 2s).
						expect(w.watcherManager.directoryWatchers.size).toBeLessThan(10);
						w.close();
						done();
					});
				});
			});

			it("should evaluate `ignored` against the symlink path for files inside a symlinked directory (#231)", (done) => {
				testHelper.dir("ext_dir");
				testHelper.file(path.join("ext_dir", "inner"));
				testHelper.symlinkDir(
					path.join("a", "b", "ext_dir_link"),
					path.join("..", "..", "ext_dir"),
				);
				testHelper.tick(2500, () => {
					const allowedPrefix = path.join(fixtures, "a", "b");
					const allowedWithSep = allowedPrefix + path.sep;
					/** @type {string[]} */
					const ignoredQueries = [];
					const w = new WatchpackTest({
						aggregateTimeout: 500,
						followSymlinks: true,
						// Mirror issue #231 example 2: allow only the watched root, the
						// ancestors of `a/b`, `a/b` itself, and anything under it. The
						// resolved target `fixtures/ext_dir/...` lies outside this allowlist.
						ignored: (entry) => {
							ignoredQueries.push(entry);
							if (entry === allowedPrefix) return false;
							if (entry.startsWith(allowedWithSep)) return false;
							// allow ancestors of the allowed prefix so we can descend into it
							if (allowedWithSep.startsWith(entry + path.sep)) return false;
							return true;
						},
					});

					/** @type {string[]} */
					const fileChanges = [];
					w.on("change", (file) => {
						fileChanges.push(file);
					});

					w.watch([], [fixtures], Date.now());

					testHelper.tick(1000, () => {
						testHelper.file(path.join("ext_dir", "inner"));
						testHelper.tick(2000, () => {
							const symlinkPath = path.join(
								fixtures,
								"a",
								"b",
								"ext_dir_link",
								"inner",
							);
							const resolvedPath = path.join(fixtures, "ext_dir", "inner");
							expect(fileChanges).toContain(symlinkPath);
							expect(fileChanges).not.toContain(resolvedPath);
							// `ignored` must have been queried with the symlink-preserving
							// path so the user's allowlist works as documented in #231.
							expect(ignoredQueries).toContain(symlinkPath);
							expect(ignoredQueries).not.toContain(resolvedPath);
							w.close();
							done();
						});
					});
				});
			});
		});
	} else {
		it("symlinks", () => {
			expect(true).toBe(true);
		});
	}
});
