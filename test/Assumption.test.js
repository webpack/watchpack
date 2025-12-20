"use strict";

const fs = require("fs");
const path = require("path");
const { createHandleChangeEvent } = require("../lib/watchEventSource");
const TestHelper = require("./helpers/TestHelper");

/** @typedef {import("fs").FSWatcher} FSWatcher */

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

const IS_OSX = require("os").platform() === "darwin";
const IS_WIN = require("os").platform() === "win32";

const SUPPORTS_RECURSIVE_WATCHING = IS_OSX || IS_WIN;

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(20000);

describe("Assumption", () => {
	/** @type {FSWatcher | null} */
	let watcherToClose = null;

	beforeEach(testHelper.before);

	afterEach((done) => {
		if (watcherToClose) {
			watcherToClose.close();
			watcherToClose = null;
		}
		testHelper.after(done);
	});

	it("should have a file system with correct mtime behavior (stats)", (done) => {
		let i = 60;
		const count = 60;
		let minDiffBefore = +Infinity;
		let maxDiffBefore = -Infinity;
		let sumDiffBefore = 0;
		let minDiffAfter = +Infinity;
		let maxDiffAfter = -Infinity;
		let sumDiffAfter = 0;

		/**
		 * @returns {void}
		 */
		function afterMeasure() {
			console.log(
				`mtime stats accuracy (before): [${minDiffBefore} ; ${
					maxDiffBefore
				}] avg ${Math.round(sumDiffBefore / count)}`,
			);

			console.log(
				`mtime stats accuracy (after): [${minDiffAfter} ; ${
					maxDiffAfter
				}] avg ${Math.round(sumDiffAfter / count)}`,
			);
			expect(minDiffBefore).toBeGreaterThanOrEqual(-2000);
			expect(maxDiffBefore).toBeLessThan(2000);
			expect(minDiffAfter).toBeGreaterThanOrEqual(-2000);
			expect(maxDiffAfter).toBeLessThan(2000);
			done();
		}

		testHelper.tick(100, function checkMtime() {
			const before = Date.now();
			testHelper.file("a");
			const after = Date.now();
			const stats = fs.statSync(path.join(fixtures, "a"));
			const diffBefore = +stats.mtime - before;
			if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
			if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
			sumDiffBefore += diffBefore;
			const diffAfter = +stats.mtime - after;
			if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
			if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
			sumDiffAfter += diffAfter;
			if (i-- === 0) {
				afterMeasure();
			} else {
				testHelper.tick(100, checkMtime);
			}
		});
	});

	it("should have a file system with correct mtime behavior (fs.watch)", (done) => {
		testHelper.file("a");
		let i = 60;
		const count = 60;
		/** @type {number | undefined} */
		let before;
		/** @type {number | undefined} */
		let after;
		let minDiffBefore = +Infinity;
		let maxDiffBefore = -Infinity;
		let sumDiffBefore = 0;
		let minDiffAfter = +Infinity;
		let maxDiffAfter = -Infinity;
		let sumDiffAfter = 0;

		/**
		 * @returns {void}
		 */
		function afterMeasure() {
			console.log(
				`mtime fs.watch accuracy (before): [${minDiffBefore} ; ${
					maxDiffBefore
				}] avg ${Math.round(sumDiffBefore / count)}`,
			);

			console.log(
				`mtime fs.watch accuracy (after): [${minDiffAfter} ; ${
					maxDiffAfter
				}] avg ${Math.round(sumDiffAfter / count)}`,
			);
			expect(minDiffBefore).toBeGreaterThanOrEqual(-2000);
			expect(maxDiffBefore).toBeLessThan(2000);
			expect(minDiffAfter).toBeGreaterThanOrEqual(-2000);
			expect(maxDiffAfter).toBeLessThan(2000);
			done();
		}

		/**
		 * @returns {void}
		 */
		function checkMtime() {
			before = Date.now();
			testHelper.file("a");
			after = Date.now();
		}

		const watcher = (watcherToClose = fs.watch(fixtures));
		testHelper.tick(100, () => {
			watcher.on("change", (type, filename) => {
				const stats = fs.statSync(
					path.join(fixtures, /** @type {string} */ (filename)),
				);
				if (before && after) {
					const diffBefore = +stats.mtime - before;
					if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
					if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
					sumDiffBefore += diffBefore;
					const diffAfter = +stats.mtime - after;
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
	});

	if (SUPPORTS_RECURSIVE_WATCHING) {
		it("should have a file system with correct mtime behavior (fs.watch recursive)", (done) => {
			testHelper.file("a");
			let i = 60;
			const count = 60;
			/** @type {number | undefined} */
			let before;
			/** @type {number | undefined} */
			let after;
			let minDiffBefore = +Infinity;
			let maxDiffBefore = -Infinity;
			let sumDiffBefore = 0;
			let minDiffAfter = +Infinity;
			let maxDiffAfter = -Infinity;
			let sumDiffAfter = 0;

			/**
			 * @returns {void}
			 */
			function afterMeasure() {
				console.log(
					`mtime fs.watch({ recursive: true }) accuracy (before): [${
						minDiffBefore
					} ; ${maxDiffBefore}] avg ${Math.round(sumDiffBefore / count)}`,
				);

				console.log(
					`mtime fs.watch({ recursive: true }) accuracy (after): [${
						minDiffAfter
					} ; ${maxDiffAfter}] avg ${Math.round(sumDiffAfter / count)}`,
				);
				expect(minDiffBefore).toBeGreaterThanOrEqual(-2000);
				expect(maxDiffBefore).toBeLessThan(2000);
				expect(minDiffAfter).toBeGreaterThanOrEqual(-2000);
				expect(maxDiffAfter).toBeLessThan(2000);
				done();
			}

			/**
			 * @returns {void}
			 */
			function checkMtime() {
				before = Date.now();
				testHelper.file("a");
				after = Date.now();
			}

			const watcher = (watcherToClose = fs.watch(fixtures, {
				recursive: true,
			}));
			testHelper.tick(100, () => {
				watcher.on("change", (type, filename) => {
					const stats = fs.statSync(
						path.join(fixtures, /** @type {string} */ (filename)),
					);
					if (before && after) {
						const diffBefore = +stats.mtime - before;
						if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
						if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
						sumDiffBefore += diffBefore;
						const diffAfter = +stats.mtime - after;
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
		});
	}

	it("should not fire events in subdirectories", (done) => {
		testHelper.dir("watch-test-directory");
		testHelper.tick(500, () => {
			const watcher = (watcherToClose = fs.watch(fixtures));
			watcher.on("change", (arg, arg2) => {
				expect(true).toBe(false);
				done(new Error(`should not be emitted ${arg} ${arg2}`));
				// @ts-expect-error for tests
				done = function () {};
			});
			watcher.on("error", (err) => {
				done(err);
				// @ts-expect-error for tests
				done = function () {};
			});
			testHelper.tick(500, () => {
				testHelper.file("watch-test-directory/watch-test-file");
				testHelper.tick(500, () => {
					done();
				});
			});
		});
	});

	if (SUPPORTS_RECURSIVE_WATCHING) {
		it("should fire events in subdirectories (recursive)", (done) => {
			testHelper.dir("watch-test-directory");
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.file("watch-test-directory/existing-file");
			testHelper.tick(500, () => {
				const watcher = (watcherToClose = fs.watch(fixtures, {
					recursive: true,
				}));
				/** @type {string[]} */
				const events = [];
				watcher.once("change", () => {
					testHelper.tick(1000, () => {
						expect(
							events.some((item) =>
								/watch-test-directory[/\\]watch-test-file/.test(item),
							),
						).toBe(true);
						done();
					});
				});
				watcher.on("change", (type, filename) => {
					events.push(/** @type {string} */ (filename));
				});
				watcher.on("error", (err) => {
					done(err);
					// @ts-expect-error for tests
					done = function () {};
				});
				testHelper.tick(500, () => {
					testHelper.file("watch-test-directory/watch-test-file");
				});
			});
		});

		it("should allow to create/close/create recursive watchers", (done) => {
			testHelper.dir("watch-test-directory");
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.file("watch-test-directory/existing-file");
			testHelper.tick(500, () => {
				watcherToClose = fs.watch(fixtures, {
					recursive: true,
				});
				watcherToClose.close();
				watcherToClose = fs.watch(fixtures, {
					recursive: true,
				});
				watcherToClose.close();
				watcherToClose = fs.watch(fixtures, {
					recursive: true,
				});
				watcherToClose.close();
				const watcher = (watcherToClose = fs.watch(fixtures, {
					recursive: true,
				}));
				/** @type {string[]} */
				const events = [];
				watcher.once("change", () => {
					testHelper.tick(1000, () => {
						expect(
							events.some((item) =>
								/watch-test-directory[/\\]watch-test-file/.test(item),
							),
						).toBe(true);
						done();
					});
				});
				watcher.on("change", (type, filename) => {
					events.push(/** @type {string} */ (filename));
				});
				watcher.on("error", (err) => {
					done(err);
					// @ts-expect-error for tests
					done = function () {};
				});
				testHelper.tick(500, () => {
					testHelper.file("watch-test-directory/watch-test-file");
				});
			});
		});
	}

	if (!IS_OSX) {
		it("should detect removed directory", (done) => {
			testHelper.dir("watch-test-dir");
			testHelper.tick(() => {
				const watcher = (watcherToClose = fs.watch(
					path.join(fixtures, "watch-test-dir"),
				));
				let gotSelfRename = false;
				let gotPermError = false;
				const handleChangeEvent = createHandleChangeEvent(
					watcher,
					path.join(fixtures, "watch-test-dir"),
					(type, filename) => {
						if (type === "rename" && filename === "watch-test-dir") {
							gotSelfRename = true;
						}
					},
				);
				watcher.on("change", handleChangeEvent);
				watcher.on("error", (err) => {
					if (
						err &&
						/** @type {NodeJS.ErrnoException} */
						(err).code === "EPERM"
					) {
						gotPermError = true;
					}
				});
				testHelper.tick(500, () => {
					testHelper.remove("watch-test-dir");
					testHelper.tick(3000, () => {
						if (gotPermError || gotSelfRename) {
							done();
						} else {
							expect(true).toBe(false);
							done(new Error("Didn't receive a event about removed directory"));
						}
					});
				});
			});
		});
	}

	for (const delay of [100, 200, 300, 500, 700, 1000].reverse()) {
		// eslint-disable-next-line no-loop-func
		it(`should fire events not after start and ${delay}ms delay`, (done) => {
			testHelper.file(`watch-test-file-${delay}`);
			testHelper.tick(delay, () => {
				const watcher = (watcherToClose = fs.watch(fixtures));
				watcher.on("change", (arg) => {
					expect(true).toBe(false);
					done(new Error(`should not be emitted ${arg}`));
					// @ts-expect-error for tests
					done = function () {};
				});
				watcher.on("error", (err) => {
					done(err);
					// @ts-expect-error for tests
					done = function () {};
				});
				testHelper.tick(500, () => {
					done();
				});
			});
		});
	}
});
