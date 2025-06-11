/* globals describe it beforeEach afterEach */
"use strict";

require("should");

const path = require("path");
const TestHelper = require("./helpers/TestHelper");
const getWatcherManager = require("../lib/getWatcherManager");
const OrgDirectoryWatcher = require("../lib/DirectoryWatcher");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

const openWatchers = [];

function DirectoryWatcher(directoryPath, options) {
	const directoryWatcher = new OrgDirectoryWatcher(
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

describe("DirectoryWatcher", function directoryWatcherTest() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);
	afterEach(() => {
		for (const watchers of openWatchers) {
			// eslint-disable-next-line no-console
			console.log(`DirectoryWatcher (${watchers.path}) was not closed.`);
			watchers.close();
		}
	});

	it("should detect a file creation", (done) => {
		const directoryWatcher = new DirectoryWatcher(fixtures, {});
		const a = directoryWatcher.watch(path.join(fixtures, "a"));
		a.on("change", (mtime) => {
			mtime.should.be.type("number");
			Object.keys(directoryWatcher.getTimes())
				.sort()
				.should.be.eql([path.join(fixtures, "a")]);
			a.close();
			done();
		});
		testHelper.tick(() => {
			testHelper.file("a");
		});
	});

	it("should detect a file change", (done) => {
		const directoryWatcher = new DirectoryWatcher(fixtures, {});
		testHelper.file("a");
		testHelper.tick(1000, () => {
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			a.on("change", (mtime) => {
				mtime.should.be.type("number");
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
			const directoryWatcher = new DirectoryWatcher(fixtures, {});
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			a.on("change", () => {
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
				const directoryWatcher = new DirectoryWatcher(fixtures, {});
				const a = directoryWatcher.watch(path.join(fixtures, "a"), start);
				a.on("change", () => {
					a.close();
					done();
				});
			});
		});
	});

	it("should not detect a file change in initial scan without start date", (done) => {
		testHelper.file("a");
		testHelper.tick(200, () => {
			const directoryWatcher = new DirectoryWatcher(fixtures, {});
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			a.on("change", (mtime, type) => {
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

	const timings = {
		slow: 300,
		fast: 50,
	};
	for (const name of Object.keys(timings)) {
		const time = timings[name];
		it(`should detect multiple file changes (${name})`, (done) => {
			const directoryWatcher = new DirectoryWatcher(fixtures, {});
			testHelper.file("a");
			testHelper.tick(() => {
				const a = directoryWatcher.watch(path.join(fixtures, "a"));
				let count = 20;
				let wasChanged = false;
				a.on("change", (mtime) => {
					mtime.should.be.type("number");
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
		const directoryWatcher = new DirectoryWatcher(fixtures, {});
		const a = directoryWatcher.watch(path.join(fixtures, "a"));
		a.on("remove", () => {
			a.close();
			done();
		});
		testHelper.tick(() => {
			testHelper.remove("a");
		});
	});

	it("should report directory as initial missing on the second watch when directory doesn't exist", (done) => {
		const wm = getWatcherManager({});
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
				initialMissing.should.be.eql(true);
				done();
			});
		});
	});

	it("should not report directory as initial missing on the second watch when directory exists", (done) => {
		const wm = getWatcherManager({});
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
				initialMissing.should.be.eql(false);
				done();
			});
		});
	});

	if (!Number(process.env.WATCHPACK_POLLING)) {
		it("should log errors emitted from watcher to stderr", (done) => {
			let errorLogged = false;
			const oldStderr = process.stderr.write;
			process.stderr.write = function write(_a) {
				errorLogged = true;
			};
			const directoryWatcher = new DirectoryWatcher(fixtures, {});
			const a = directoryWatcher.watch(path.join(fixtures, "a"));
			directoryWatcher.watcher.emit("error", "error_message");

			testHelper.tick(() => {
				a.close();
				process.stderr.write = oldStderr;
				errorLogged.should.be.true();
				done();
			});
		});
	}
});
