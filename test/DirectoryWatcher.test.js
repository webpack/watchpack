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

		it("does not emit remove when lstat keeps returning EBUSY", (done) => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
				const a = directoryWatcher.watch(path.join(fixtures, "a"));

				// Replace the instance helper so every lstat for "a" returns EBUSY.
				// The retry loop inside _lstatWithRetry is bypassed here; what
				// we're asserting is that onWatchEvent doesn't fall through to
				// setMissing when it sees an EBUSY (the actual user-visible fix
				// for #223).
				const realLstat =
					// @ts-expect-error reaching into a private method for test
					directoryWatcher._lstatWithRetry.bind(directoryWatcher);
				// @ts-expect-error reaching into a private method for test
				directoryWatcher._lstatWithRetry = (target, callback) => {
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
						expect(removed).toBe(false);
						done();
					});
				});
			});
		});
	});
});
