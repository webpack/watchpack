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

	const IS_OSX = require("os").platform() === "darwin";

	/** @type {Record<"slow" | "fast", number>} */
	// FSEvents coalesces rapid changes, so on macOS the "fast" case needs a
	// larger interval or consecutive writes will be dropped.
	const timings = {
		slow: 300,
		fast: IS_OSX ? 150 : 50,
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

	describe("permission error suppression (#187)", () => {
		/**
		 * @param {string} code error code to attach
		 * @returns {NodeJS.ErrnoException} fabricated errno error
		 */
		const makeErr = (code) => {
			const err = /** @type {NodeJS.ErrnoException} */ (new Error(code));
			err.code = code;
			return err;
		};

		const IS_WIN = require("os").platform() === "win32";

		// On WSL, scanning `/mnt/c` lists files like `pagefile.sys` whose lstat
		// returns EACCES; on native Windows + Node ≥22.17 the same paths now
		// return EINVAL via libuv; on Linux a lstat that traverses an
		// unmounted device entry (e.g. `/efi`) returns ENODEV. All used to
		// print "Watchpack Error (initial scan): …"; all should be silent.
		const lstatCodes = IS_WIN
			? ["EACCES", "EPERM", "ENODEV", "EINVAL"]
			: ["EACCES", "EPERM", "ENODEV"];
		for (const code of lstatCodes) {
			it(`does not log when an item lstat returns ${code} during initial scan`, (done) => {
				testHelper.file("a");
				testHelper.tick(() => {
					const fs = require("graceful-fs");

					const originalLstat = fs.lstat;

					// eslint-disable-next-line jsdoc/reject-any-type
					/** @type {any} */ (fs).lstat = (
						/** @type {string} */ target,
						/** @type {(err: NodeJS.ErrnoException | null) => void} */ cb,
					) => {
						if (target.endsWith(`${path.sep}a`)) {
							process.nextTick(() => cb(makeErr(code)));
							return;
						}
						originalLstat(target, cb);
					};

					const errorSpy = jest
						.spyOn(console, "error")
						.mockImplementation(() => {});
					const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
					const a = directoryWatcher.watch(path.join(fixtures, "a"));

					testHelper.tick(500, () => {
						// eslint-disable-next-line jsdoc/reject-any-type
						/** @type {any} */ (fs).lstat = originalLstat;
						a.close();
						const printed = errorSpy.mock.calls
							.map((call) => String(call[0]))
							.filter((msg) => msg.includes("initial scan"));
						errorSpy.mockRestore();
						expect(printed).toEqual([]);
						done();
					});
				});
			});
		}

		const readdirCodes = IS_WIN
			? ["EACCES", "ENODEV", "EINVAL"]
			: ["EACCES", "ENODEV"];
		for (const code of readdirCodes) {
			it(`does not log when readdir on the watched directory returns ${code}`, (done) => {
				const fs = require("graceful-fs");

				const originalReaddir = fs.readdir;

				// eslint-disable-next-line jsdoc/reject-any-type
				/** @type {any} */ (fs).readdir = (
					/** @type {string} */ target,
					/** @type {(err: NodeJS.ErrnoException | null) => void} */ cb,
				) => {
					if (target === fixtures) {
						process.nextTick(() => cb(makeErr(code)));
						return;
					}
					originalReaddir(target, cb);
				};

				const errorSpy = jest
					.spyOn(console, "error")
					.mockImplementation(() => {});
				const directoryWatcher = getDirectoryWatcher(fixtures, EMPTY_OPTIONS);
				const a = directoryWatcher.watch(path.join(fixtures, "a"));

				testHelper.tick(500, () => {
					// eslint-disable-next-line jsdoc/reject-any-type
					/** @type {any} */ (fs).readdir = originalReaddir;
					a.close();
					const printed = errorSpy.mock.calls
						.map((call) => String(call[0]))
						.filter((msg) => msg.includes("initial scan"));
					errorSpy.mockRestore();
					expect(printed).toEqual([]);
					done();
				});
			});
		}
	});

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

				let removed = false;
				a.on("remove", () => {
					removed = true;
				});

				// Wait for the initial scan to finish with the real lstat, then
				// hijack graceful-fs's lstat so every call for "a" returns EBUSY
				// and assert that onWatchEvent does not fall through to a remove.
				testHelper.tick(500, () => {
					const fs = require("graceful-fs");

					const originalLstat = fs.lstat;
					// eslint-disable-next-line jsdoc/reject-any-type
					/** @type {any} */ (fs).lstat = (
						/** @type {string} */ target,
						/** @type {(err: NodeJS.ErrnoException | null) => void} */ cb,
					) => {
						if (target.endsWith(`${path.sep}a`)) {
							process.nextTick(() => cb(makeEbusy()));
							return;
						}
						originalLstat(target, cb);
					};

					directoryWatcher.onWatchEvent("change", "a");
					// 3 retries × 100 ms + buffer.
					testHelper.tick(800, () => {
						// eslint-disable-next-line jsdoc/reject-any-type
						/** @type {any} */ (fs).lstat = originalLstat;
						a.close();
						expect(removed).toBe(false);
						done();
					});
				});
			});
		});
	});
});
