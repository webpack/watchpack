"use strict";

const path = require("path");
const DirectoryWatcher = require("../lib/DirectoryWatcher");
const getWatcherManager = require("../lib/getWatcherManager");
const TestHelper = require("./helpers/TestHelper");

/** @typedef {import("../lib/DirectoryWatcher").DirectoryWatcherOptions} DirectoryWatcherOptions */

/** @type {DirectoryWatcherOptions} */
const EMPTY_OPTIONS = {};
const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

/** @type {DirectoryWatcher[]} */
const openWatchers = [];

/**
 * @param {string} directoryPath directory path
 * @param {DirectoryWatcherOptions} options options
 * @returns {DirectoryWatcher} directory watcher
 */
function getDirectoryWatcher(directoryPath, options) {
	const directoryWatcher = new DirectoryWatcher(
		getWatcherManager(options),
		directoryPath,
		options,
	);
	openWatchers.push(directoryWatcher);
	const orgClose = directoryWatcher.close;
	directoryWatcher.close = function close() {
		orgClose.call(this);
		const idx = openWatchers.indexOf(directoryWatcher);
		if (idx < 0) throw new Error("DirectoryWatcher was already closed");
		openWatchers.splice(idx, 1);
	};
	return directoryWatcher;
}

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(10000);

describe("DirectoryWatcher", () => {
	beforeEach((done) => {
		testHelper.before(done);
	});

	afterEach((done) => {
		testHelper.after(() => {
			for (const watchers of openWatchers) {
				console.log(`DirectoryWatcher (${watchers.path}) was not closed.`);
				watchers.close();
			}

			done();
		});
	});

	it("should detect a file creation", (done) => {
		const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
		const a = directoryWatcher.watch(path.join(fixtures, "a"));
		a.on("change", (mtime) => {
			expect(typeof mtime).toBe("number");
			expect(Object.keys(directoryWatcher.getTimes()).sort()).toEqual([
				path.join(fixtures, "a"),
			]);
			a.close();
			done();
		});
		testHelper.tick(() => {
			testHelper.file("a");
		});
	});

	it("should detect a file change", (done) => {
		const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
		testHelper.file("a");
		testHelper.tick(1000, () => {
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			a.on("change", (mtime) => {
				expect(typeof mtime).toBe("number");
				a.close();
				done();
			});
			testHelper.tick(() => {
				testHelper.file("a");
			});
		});
	});

	it("should not detect a file change in initial scan", (done) => {
		testHelper.file("a");
		testHelper.tick(() => {
			const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			a.on("change", () => {
				expect(true).toBe(false);
				throw new Error("should not be detected");
			});
			testHelper.tick(() => {
				a.close();
				done();
			});
		});
	});

	it("should detect a file change in initial scan with start date", (done) => {
		const start = new Date();
		testHelper.tick(1000, () => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
				const a = directoryWatcher.watch(path.join(fixtures, "a"), +start);
				a.on("change", () => {
					expect(true).toBe(true);
					a.close();
					done();
				});
			});
		});
	});

	it("should not detect a file change in initial scan without start date", (done) => {
		testHelper.file("a");
		testHelper.tick(200, () => {
			const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			a.on("change", (mtime, type) => {
				expect(true).toBe(false);
				throw new Error(
					`should not be detected (${type} mtime=${mtime} now=${Date.now()})`,
				);
			});
			testHelper.tick(() => {
				a.close();
				done();
			});
		});
	});

	/** @type {Record<"slow" | "fast", number>} */
	const timings = {
		slow: 300,
		fast: 50,
	};
	for (const name of Object.keys(timings)) {
		const time = timings[/** @type {keyof typeof timings} */ (name)];

		it(`should detect multiple file changes (${name})`, (done) => {
			const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
			testHelper.file("a");
			testHelper.tick(() => {
				const a = directoryWatcher.watch(path.join(fixtures, "a"));
				let count = 20;
				let wasChanged = false;
				a.on("change", (mtime) => {
					expect(typeof mtime).toBe("number");
					if (!wasChanged) return;
					wasChanged = false;
					if (count-- <= 0) {
						a.close();
						done();
					} else {
						testHelper.tick(time, () => {
							wasChanged = true;
							testHelper.file("a");
						});
					}
				});
				testHelper.tick(() => {
					wasChanged = true;
					testHelper.file("a");
				});
			});
		});
	}

	it("should detect a file removal", (done) => {
		testHelper.file("a");
		const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
		const a = directoryWatcher.watch(path.join(fixtures, "a"));
		a.on("remove", () => {
			expect(true).toBe(true);
			a.close();
			done();
		});
		testHelper.tick(() => {
			testHelper.remove("a");
		});
	});

	it("should report directory as initial missing on the second watch when directory doesn't exist", (done) => {
		const wm = getWatcherManager(EMPTY_OPTIONS);
		testHelper.dir("dir1");
		wm.watchDirectory(path.join(fixtures, "dir1"));

		testHelper.tick(() => {
			let initialMissing = false;
			wm.watchDirectory(path.join(fixtures, "dir3")).on(
				"initial-missing",
				() => {
					initialMissing = true;
				},
			);
			testHelper.tick(() => {
				for (const [, w] of wm.directoryWatchers) {
					w.close();
				}
				expect(initialMissing).toBe(true);
				done();
			});
		});
	});

	it("should not report directory as initial missing on the second watch when directory exists", (done) => {
		const wm = getWatcherManager(EMPTY_OPTIONS);
		testHelper.dir("dir1");
		wm.watchDirectory(path.join(fixtures, "dir1"));

		testHelper.tick(() => {
			let initialMissing = false;
			wm.watchDirectory(path.join(fixtures, "dir1")).on(
				"initial-missing",
				() => {
					initialMissing = true;
				},
			);
			testHelper.tick(() => {
				for (const [, w] of wm.directoryWatchers) {
					w.close();
				}
				expect(initialMissing).toBe(false);
				done();
			});
		});
	});

	if (!Number(process.env.WATCHPACK_POLLING)) {
		it("should log errors emitted from watcher to stderr", (done) => {
			const errorSpy = jest.spyOn(console, "error");
			const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			if (!directoryWatcher.watcher) {
				done(new Error("No watcher"));
				return;
			}
			directoryWatcher.watcher.emit("error", "error_message");

			testHelper.tick(() => {
				a.close();
				expect(errorSpy).toHaveBeenCalled();
				done();
			});
		});
	}

	describe("EBUSY retry handling (#223)", () => {
		/**
		 * @returns {NodeJS.ErrnoException} EBUSY error
		 */
		const makeEbusy = () => {
			const err = /** @type {NodeJS.ErrnoException} */ (new Error("EBUSY"));
			err.code = "EBUSY";
			return err;
		};

		it("retries lstat on EBUSY and does not flag the file as missing", (done) => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				const directoryWatcher = getDirectoryWatcher(fixtures, {
					busyRetries: 4,
					busyRetryDelay: 10,
				});
				const a = directoryWatcher.watch(path.join(fixtures, "a"));

				// Swap the instance helper: first two calls for "a" fail with EBUSY,
				// subsequent calls fall through to the real implementation. With
				// retries the watcher should recover without emitting a remove.
				const realLstat =
					directoryWatcher.lstatWithRetry.bind(directoryWatcher);
				let ebusyCalls = 0;
				directoryWatcher.lstatWithRetry = (target, callback) => {
					if (ebusyCalls < 2 && target.endsWith(`${path.sep}a`)) {
						ebusyCalls++;
						process.nextTick(() =>
							/** @type {(err: NodeJS.ErrnoException | null, stats?: import("fs").Stats) => void} */
							(callback)(makeEbusy()),
						);
						return;
					}
					realLstat(target, callback);
				};

				let removed = false;
				a.on("remove", () => {
					removed = true;
				});

				testHelper.tick(() => {
					// Trigger a synthetic watch event for the file and wait long
					// enough for all retries to complete.
					directoryWatcher.onWatchEvent("change", "a");
					testHelper.tick(300, () => {
						a.close();
						expect(removed).toBe(false);
						expect(ebusyCalls).toBeGreaterThan(0);
						done();
					});
				});
			});
		});

		it("does not emit remove when lstat keeps returning EBUSY within the retry budget", (done) => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				const directoryWatcher = getDirectoryWatcher(fixtures, {
					busyRetries: 2,
					busyRetryDelay: 10,
				});
				const a = directoryWatcher.watch(path.join(fixtures, "a"));

				const realLstat =
					directoryWatcher.lstatWithRetry.bind(directoryWatcher);
				directoryWatcher.lstatWithRetry = (target, callback) => {
					if (target.endsWith(`${path.sep}a`)) {
						process.nextTick(() =>
							/** @type {(err: NodeJS.ErrnoException | null, stats?: import("fs").Stats) => void} */
							(callback)(makeEbusy()),
						);
						return;
					}
					realLstat(target, callback);
				};

				let removed = false;
				a.on("remove", () => {
					removed = true;
				});

				testHelper.tick(() => {
					directoryWatcher.onWatchEvent("change", "a");
					testHelper.tick(300, () => {
						a.close();
						// Even after all retries are exhausted, EBUSY should not
						// make us emit a remove for the file.
						expect(removed).toBe(false);
						done();
					});
				});
			});
		});

		it("busyRetries: 0 restores the previous behaviour (marks missing on EBUSY)", (done) => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				const directoryWatcher = getDirectoryWatcher(fixtures, {
					busyRetries: 0,
				});
				expect(directoryWatcher.busyRetries).toBe(0);
				const a = directoryWatcher.watch(path.join(fixtures, "a"));

				let removed = false;
				a.on("remove", () => {
					removed = true;
				});

				// Wait for the initial scan to track the file, then swap in the
				// EBUSY mock and fire a synthetic watch event.
				testHelper.tick(500, () => {
					const realLstat =
						directoryWatcher.lstatWithRetry.bind(directoryWatcher);
					directoryWatcher.lstatWithRetry = (target, callback) => {
						if (target.endsWith(`${path.sep}a`)) {
							process.nextTick(() =>
								/** @type {(err: NodeJS.ErrnoException | null, stats?: import("fs").Stats) => void} */
								(callback)(makeEbusy()),
							);
							return;
						}
						realLstat(target, callback);
					};

					directoryWatcher.onWatchEvent("change", "a");
					testHelper.tick(150, () => {
						a.close();
						expect(removed).toBe(true);
						done();
					});
				});
			});
		});

		it("uses sensible defaults for busyRetries and busyRetryDelay", () => {
			const directoryWatcher = getDirectoryWatcher(fixtures, {});
			expect(directoryWatcher.busyRetries).toBe(3);
			expect(directoryWatcher.busyRetryDelay).toBe(100);
			directoryWatcher.close();
		});

		it("accepts busyRetries: false to disable retrying", () => {
			const directoryWatcher = getDirectoryWatcher(fixtures, {
				busyRetries: false,
			});
			expect(directoryWatcher.busyRetries).toBe(0);
			directoryWatcher.close();
		});
	});
});
