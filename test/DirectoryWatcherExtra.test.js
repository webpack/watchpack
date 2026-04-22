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

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(20000);

describe("DirectoryWatcher extra coverage", () => {
	beforeEach((done) => {
		testHelper.before(done);
	});

	afterEach((done) => {
		testHelper.after(done);
	});

	it("should be a no-op to close() twice", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const w = dw.watch(path.join(fixtures, "no-such"));
		testHelper.tick(200, () => {
			expect(() => {
				w.close();
				// second close is OK via emitting closed again
				w.close();
			}).not.toThrow();
			done();
		});
	});

	it("should expose exported Watcher class and EXISTANCE_ONLY_TIME_ENTRY", () => {
		expect(typeof DirectoryWatcher).toBe("function");
		expect(typeof DirectoryWatcher.Watcher).toBe("function");
		expect(DirectoryWatcher.EXISTANCE_ONLY_TIME_ENTRY).toBeDefined();
		expect(Object.isFrozen(DirectoryWatcher.EXISTANCE_ONLY_TIME_ENTRY)).toBe(
			true,
		);
	});

	it("watcher.checkStartTime handles startTime branches", () => {
		const fakeDir = {};
		const watcher = new DirectoryWatcher.Watcher(fakeDir, "/tmp/x", 100);
		expect(watcher.startTime).toBe(100);
		// start time < mtime => true
		expect(watcher.checkStartTime(200, false)).toBe(true);
		// start time > mtime => false
		expect(watcher.checkStartTime(50, false)).toBe(false);

		// no startTime case
		const watcher2 = new DirectoryWatcher.Watcher(fakeDir, "/tmp/x");
		// no startTime, initial=true -> return !initial = false
		expect(watcher2.checkStartTime(1000, true)).toBe(false);
		// no startTime, initial=false -> return !initial = true
		expect(watcher2.checkStartTime(1000, false)).toBe(true);

		// close is a safe no-op
		watcher.close();
		watcher2.close();
	});

	it("setNestedWatching to the same state should be a no-op", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		// Already false by default
		expect(dw.nestedWatching).toBe(false);
		dw.setNestedWatching(false); // same state, no-op
		expect(dw.nestedWatching).toBe(false);
		// Switch to true
		dw.setNestedWatching(true);
		expect(dw.nestedWatching).toBe(true);
		dw.setNestedWatching(true); // same state, no-op
		expect(dw.nestedWatching).toBe(true);
		dw.close();
	});

	it("onStatsError logs when given an error", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		dw.onStatsError(new Error("stats-fail"));
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Watchpack Error (stats)"),
		);
		errorSpy.mockRestore();
		dw.close();
	});

	it("onStatsError without an error is a no-op", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		dw.onStatsError();
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
		dw.close();
	});

	it("onScanError logs and finalizes the scan", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		dw.onScanError(new Error("scan-fail"));
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Watchpack Error (initial scan)"),
		);
		errorSpy.mockRestore();
		dw.close();
	});

	it("onScanError without an error still finalizes the scan", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		dw.onScanError();
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
		dw.close();
	});

	it("onWatcherError does not log for EPERM or ENOENT", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const errPerm = Object.assign(new Error("perm"), { code: "EPERM" });
		const errEnoent = Object.assign(new Error("ent"), { code: "ENOENT" });
		dw.onWatcherError(errPerm);
		dw.onWatcherError(errEnoent);
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
		testHelper.tick(100, () => {
			dw.close();
			done();
		});
	});

	it("onWatcherError logs for other error codes", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		const err = Object.assign(new Error("unexpected"), { code: "EMFILE" });
		dw.onWatcherError(err);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Watchpack Error (watcher)"),
		);
		errorSpy.mockRestore();
		testHelper.tick(100, () => {
			dw.close();
			done();
		});
	});

	it("onWatcherError with no error is a no-op", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		dw.onWatcherError();
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
		dw.close();
	});

	it("onWatcherError after close is a no-op", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		dw.close();
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		dw.onWatcherError(new Error("after"));
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("onWatchEvent after close is a no-op", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		dw.close();
		expect(() => dw.onWatchEvent("rename", "x.txt")).not.toThrow();
	});

	it("onWatchEvent ignores paths matched by ignored()", () => {
		const dw = new DirectoryWatcher(getWatcherManager({}), fixtures, {
			ignored: (item) => item.endsWith("skip-me"),
		});
		expect(() => dw.onWatchEvent("rename", "skip-me")).not.toThrow();
		dw.close();
	});

	it("onWatchEvent triggers a rescan when filename is missing", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		let calledWithInitial = null;
		const orig = dw.doScan.bind(dw);
		dw.doScan = function doScan(initial) {
			calledWithInitial = initial;
			return orig(initial);
		};
		dw.onWatchEvent("change");
		expect(calledWithInitial).toBe(false);
		testHelper.tick(300, () => {
			dw.close();
			done();
		});
	});

	it("setDirectory on the directory itself emits a change only when not initial", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const w = dw.watch(fixtures);
		let changeCount = 0;
		w.on("change", () => {
			changeCount++;
		});
		// initial=true branch: no event emitted
		dw.setDirectory(fixtures, Date.now(), true, "scan (dir)");
		// initial=false branch: event emitted
		dw.setDirectory(fixtures, Date.now(), false, "change");
		expect(changeCount).toBe(1);
		w.close();
	});

	it("setMissing on a non-existent item is a no-op", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "not-there");
		expect(() => dw.setMissing(target, false, "scan (missing)")).not.toThrow();
		dw.close();
	});

	it("directoryWatcher constructor accepts no options", () => {
		const dw = new DirectoryWatcher(getWatcherManager({}), fixtures);
		expect(dw.polledWatching).toBe(false);
		expect(dw.ignored("anything")).toBe(false);
		dw.close();
	});

	it("directoryWatcher with poll:true defaults to 5007ms", () => {
		const options = { poll: true };
		const dw = new DirectoryWatcher(
			getWatcherManager(options),
			fixtures,
			options,
		);
		expect(dw.polledWatching).toBe(5007);
		dw.close();
	});

	it("directoryWatcher with poll:number uses that number", () => {
		const options = { poll: 123 };
		const dw = new DirectoryWatcher(
			getWatcherManager(options),
			fixtures,
			options,
		);
		expect(dw.polledWatching).toBe(123);
		dw.close();
	});

	it("forEachWatcher should noop if no watcher registered for path", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		let called = false;
		dw.forEachWatcher("/no/such/path", () => {
			called = true;
		});
		expect(called).toBe(false);
		dw.close();
	});

	it("onDirectoryRemoved emits remove for tracked files and directories", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		dw.files.set(path.join(fixtures, "f1"), {
			safeTime: Date.now(),
			timestamp: Date.now(),
			accuracy: 10,
		});
		dw.filesWithoutCase.set(path.join(fixtures, "f1").toLowerCase(), 1);
		dw.directories.set(path.join(fixtures, "d1"), true);
		let removeEvents = 0;
		const w1 = dw.watch(path.join(fixtures, "f1"));
		const w2 = dw.watch(path.join(fixtures, "d1"));
		w1.on("remove", () => {
			removeEvents++;
		});
		w2.on("remove", () => {
			removeEvents++;
		});
		dw.onDirectoryRemoved("test");
		testHelper.tick(300, () => {
			expect(removeEvents).toBeGreaterThanOrEqual(2);
			w1.close();
			w2.close();
			dw.close();
			done();
		});
	});

	it("doScan with scanAgain already set flips scanAgainInitial to false when non-initial", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		// Force scanning=true and scanAgain=true with initial=true
		dw.scanning = true;
		dw.scanAgain = true;
		dw.scanAgainInitial = true;
		dw.doScan(false);
		expect(dw.scanAgainInitial).toBe(false);
		// Cleanup
		dw.scanning = false;
		dw.scanAgain = false;
		dw.close();
		testHelper.tick(100, done);
	});

	it("fixupEntryAccuracy adjusts entries whose accuracy exceeds FS_ACCURACY", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const file = path.join(fixtures, "something");
		// Pre-seed with an absurdly high accuracy. FS_ACCURACY maxes at 2000 and
		// only decreases, so any entry with accuracy greater than 2000 (or after
		// FS_ACCURACY has dropped) will trigger the fixup branch.
		dw.files.set(file, {
			safeTime: 100000,
			timestamp: 100000,
			accuracy: 100000,
		});
		const times = dw.getTimes();
		// safeTime was adjusted down: safeTime = safeTime - accuracy + FS_ACCURACY
		// max(entry.safeTime, entry.timestamp) after adjustment = 100000 (timestamp)
		expect(times[file]).toBe(100000);
		dw.close();
	});

	it("setNestedWatching true->false closes nested watchers", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		dw.setNestedWatching(true);
		expect(dw.nestedWatching).toBe(true);
		// Add a fake directory with a closable watcher
		let closed = false;
		dw.directories.set(path.join(fixtures, "d1"), {
			close() {
				closed = true;
			},
		});
		dw.setNestedWatching(false);
		expect(closed).toBe(true);
		expect(dw.nestedWatching).toBe(false);
		expect(dw.directories.get(path.join(fixtures, "d1"))).toBe(true);
		dw.close();
	});

	it("setNestedWatching false->true creates nested watchers for pre-populated directories", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		// Directly populate a fake entry to exercise the createNestedWatcher loop
		const childDir = path.join(fixtures, "child-dir-marker");
		dw.directories.set(childDir, true);
		dw.setNestedWatching(true);
		expect(dw.nestedWatching).toBe(true);
		const created = dw.directories.get(childDir);
		expect(created).not.toBe(true);
		// Cleanup the nested watcher before closing
		dw.setNestedWatching(false);
		dw.close();
	});

	it("setFileTime detects a case-insensitive duplicate and triggers a rescan", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		let scanCount = 0;
		const origScan = dw.doScan.bind(dw);
		dw.doScan = function doScan(initial) {
			scanCount++;
			return origScan(initial);
		};
		const fA = path.join(fixtures, "Aaa");
		const fB = path.join(fixtures, "aaa");
		// First file
		dw.setFileTime(fA, Date.now(), true, false, "scan (file)");
		const countBefore = scanCount;
		// Second file with case-insensitive-equal name triggers rescan
		dw.setFileTime(fB, Date.now(), true, false, "scan (file)");
		expect(scanCount).toBeGreaterThan(countBefore);
		dw.close();
	});

	it("setFileTime without initial triggers change on existing watcher", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "file");
		// Preload an existing entry
		dw.files.set(target, {
			safeTime: Date.now() - 10000,
			timestamp: Date.now() - 10000,
			accuracy: 10,
		});
		const w = dw.watch(target);
		let gotChange = false;
		w.on("change", () => {
			gotChange = true;
		});
		dw.setFileTime(target, Date.now(), false, false, "change");
		expect(gotChange).toBe(true);
		w.close();
		dw.close();
	});

	it("setFileTime skips when timestamp is unchanged and old is stable", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "file");
		const ts = Date.now() - 10000;
		dw.files.set(target, {
			safeTime: ts,
			timestamp: ts,
			accuracy: 0,
		});
		const w = dw.watch(target);
		let gotChange = false;
		w.on("change", () => {
			gotChange = true;
		});
		// Same mtime and mtime + FS_ACCURACY(2000) < now => skip
		dw.setFileTime(target, ts, false, false, "change");
		expect(gotChange).toBe(false);
		w.close();
		dw.close();
	});

	it("setFileTime with ignoreWhenEqual skips when timestamp matches", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "file");
		const ts = Date.now();
		dw.files.set(target, { safeTime: ts, timestamp: ts, accuracy: 0 });
		const w = dw.watch(target);
		let gotChange = false;
		w.on("change", () => {
			gotChange = true;
		});
		dw.setFileTime(target, ts, true, true, "scan (file)");
		expect(gotChange).toBe(false);
		w.close();
		dw.close();
	});

	it("setMissing emits remove event when file is currently tracked", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "file");
		const lowerKey = target.toLowerCase();
		dw.files.set(target, {
			safeTime: Date.now(),
			timestamp: Date.now(),
			accuracy: 0,
		});
		dw.filesWithoutCase.set(lowerKey, 1);
		const w = dw.watch(target);
		let gotRemove = false;
		w.on("remove", () => {
			gotRemove = true;
		});
		dw.setMissing(target, false, "scan (missing)");
		testHelper.tick(100, () => {
			expect(gotRemove).toBe(true);
			w.close();
			dw.close();
			done();
		});
	});

	it("watch() with outdated safeTime emits change for file watcher", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "some-file");
		const safeTime = Date.now() - 1000;
		dw.files.set(target, {
			safeTime,
			timestamp: safeTime,
			accuracy: 0,
		});
		const startTime = safeTime - 100; // startTime < safeTime, triggers emit
		const w = dw.watch(target, startTime);
		let gotChange = false;
		w.on("change", () => {
			gotChange = true;
		});
		process.nextTick(() => {
			testHelper.tick(100, () => {
				expect(gotChange).toBe(true);
				w.close();
				dw.close();
				done();
			});
		});
	});

	it("watch() emits remove when the target was marked removed during initial scan", (done) => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const target = path.join(fixtures, "removed-during-scan");
		// Still in initial scan
		expect(dw.initialScan).toBe(true);
		dw.initialScanRemoved.add(target);
		const w = dw.watch(target);
		let gotRemove = false;
		w.on("remove", () => {
			gotRemove = true;
		});
		testHelper.tick(100, () => {
			expect(gotRemove).toBe(true);
			w.close();
			dw.close();
			done();
		});
	});

	it("setMissing decrements filesWithoutCase counter when count > 1", () => {
		const dw = new DirectoryWatcher(
			getWatcherManager(EMPTY_OPTIONS),
			fixtures,
			EMPTY_OPTIONS,
		);
		const t1 = path.join(fixtures, "aaa");
		const lowerKey = t1.toLowerCase();
		dw.files.set(t1, {
			safeTime: Date.now(),
			timestamp: Date.now(),
			accuracy: 0,
		});
		dw.filesWithoutCase.set(lowerKey, 2); // more than one
		dw.setMissing(t1, false, "scan (missing)");
		expect(dw.filesWithoutCase.get(lowerKey)).toBe(1);
		dw.close();
	});
});
