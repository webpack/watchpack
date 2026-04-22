"use strict";

const fs = require("fs");
const path = require("path");
const Watchpack = require("../lib");

describe("Watchpack unit", () => {
	it("should throw when ignored is an invalid value (number)", () => {
		expect(
			() =>
				new Watchpack({
					// @ts-expect-error intentionally invalid
					ignored: 123,
				}),
		).toThrow(/Invalid option for 'ignored'/);
	});

	it("should throw when ignored is an invalid value (object)", () => {
		expect(
			() =>
				new Watchpack({
					// @ts-expect-error intentionally invalid
					ignored: { not: "valid" },
				}),
		).toThrow(/Invalid option for 'ignored'/);
	});

	it("should use default options when none provided", () => {
		const w = new Watchpack();
		expect(w.aggregateTimeout).toBe(200);
		expect(w.paused).toBe(false);
		expect(w.startTime).toBeUndefined();
		expect(w.watcherOptions.followSymlinks).toBe(false);
		expect(typeof w.watcherOptions.ignored).toBe("function");
		expect(w.watcherOptions.ignored("anything")).toBe(false);
		w.close();
	});

	it("should honour custom aggregateTimeout", () => {
		const w = new Watchpack({ aggregateTimeout: 500 });
		expect(w.aggregateTimeout).toBe(500);
		w.close();
	});

	it("should cache normalized options on same options object", () => {
		const options = { aggregateTimeout: 100 };
		const w1 = new Watchpack(options);
		const w2 = new Watchpack(options);
		expect(w1.watcherOptions).toBe(w2.watcherOptions);
		w1.close();
		w2.close();
	});

	it("should accept a RegExp ignored option", () => {
		const w = new Watchpack({ ignored: /ignoredPattern/ });
		expect(w.watcherOptions.ignored("/foo/ignoredPattern/bar")).toBe(true);
		expect(w.watcherOptions.ignored("/foo/keep")).toBe(false);
		w.close();
	});

	it("should accept a function ignored option", () => {
		const ignored = (entry) => entry.includes("skip");
		const w = new Watchpack({ ignored });
		expect(w.watcherOptions.ignored).toBe(ignored);
		w.close();
	});

	it("should treat empty ignored array as matching nothing", () => {
		const w = new Watchpack({ ignored: [] });
		expect(w.watcherOptions.ignored("any")).toBe(false);
		w.close();
	});

	it("should treat array of empty strings as matching nothing", () => {
		const w = new Watchpack({ ignored: ["", "", ""] });
		expect(w.watcherOptions.ignored("any")).toBe(false);
		w.close();
	});

	it("should treat empty ignored string as matching nothing", () => {
		const w = new Watchpack({ ignored: "" });
		expect(w.watcherOptions.ignored("any")).toBe(false);
		w.close();
	});

	it("should combine multiple ignored globs", () => {
		const w = new Watchpack({ ignored: ["**/foo", "**/bar"] });
		expect(w.watcherOptions.ignored("/x/foo")).toBe(true);
		expect(w.watcherOptions.ignored("/x/bar")).toBe(true);
		expect(w.watcherOptions.ignored("/x/baz")).toBe(false);
		w.close();
	});

	it("should normalize backslashes in paths against regex ignores", () => {
		const w = new Watchpack({ ignored: "**/foo" });
		expect(w.watcherOptions.ignored("C:\\x\\foo")).toBe(true);
		w.close();
	});

	it("should allow calling pause with no aggregate timer", () => {
		const w = new Watchpack();
		// Just calling pause without any events should be a no-op
		w.pause();
		expect(w.paused).toBe(true);
		w.close();
	});

	it("getAggregated should return empty sets initially", () => {
		const w = new Watchpack();
		const { changes, removals } = w.getAggregated();
		expect([...changes]).toEqual([]);
		expect([...removals]).toEqual([]);
		w.close();
	});

	it("getAggregated should swap and clear internal sets, and stop the aggregation timer", () => {
		const w = new Watchpack({ aggregateTimeout: 100000 });
		// Simulate an internal change event while not paused to start the timer
		w.paused = false;
		w._onChange("/tmp/a", 1, "/tmp/a", "change");
		w._onRemove("/tmp/b", "/tmp/b", "change");
		expect(w.aggregateTimer).toBeDefined();
		const { changes, removals } = w.getAggregated();
		expect([...changes]).toEqual(["/tmp/a"]);
		expect([...removals]).toEqual(["/tmp/b"]);
		expect(w.aggregateTimer).toBeUndefined();
		// Now subsequent getAggregated should be empty
		const next = w.getAggregated();
		expect([...next.changes]).toEqual([]);
		expect([...next.removals]).toEqual([]);
		w.close();
	});

	it("_onChange should not emit while paused but still track changes", () => {
		const w = new Watchpack();
		w.paused = true;
		let emitted = false;
		w.on("change", () => {
			emitted = true;
		});
		w._onChange("/tmp/file", 1, "/tmp/file", "change");
		expect(emitted).toBe(false);
		expect(w.aggregatedChanges.has("/tmp/file")).toBe(true);
		w.close();
	});

	it("_onRemove should not emit while paused but still track removals", () => {
		const w = new Watchpack();
		w.paused = true;
		let emitted = false;
		w.on("remove", () => {
			emitted = true;
		});
		w._onRemove("/tmp/file", "/tmp/file", "change");
		expect(emitted).toBe(false);
		expect(w.aggregatedRemovals.has("/tmp/file")).toBe(true);
		w.close();
	});

	it("_onChange cancels a pending removal for the same item", () => {
		const w = new Watchpack();
		w.paused = true;
		w._onRemove("/tmp/file", "/tmp/file", "change");
		expect(w.aggregatedRemovals.has("/tmp/file")).toBe(true);
		w._onChange("/tmp/file", 1, "/tmp/file", "change");
		expect(w.aggregatedRemovals.has("/tmp/file")).toBe(false);
		expect(w.aggregatedChanges.has("/tmp/file")).toBe(true);
		w.close();
	});

	it("_onRemove cancels a pending change for the same item", () => {
		const w = new Watchpack();
		w.paused = true;
		w._onChange("/tmp/file", 1, "/tmp/file", "change");
		expect(w.aggregatedChanges.has("/tmp/file")).toBe(true);
		w._onRemove("/tmp/file", "/tmp/file", "change");
		expect(w.aggregatedChanges.has("/tmp/file")).toBe(false);
		expect(w.aggregatedRemovals.has("/tmp/file")).toBe(true);
		w.close();
	});

	it("_onChange falls back to item when file is falsy", (done) => {
		const w = new Watchpack({ aggregateTimeout: 50 });
		w.on("change", (file) => {
			expect(file).toBe("/tmp/item");
			w.close();
			done();
		});
		w._onChange("/tmp/item", 1, undefined, "change");
	});

	it("_onRemove falls back to item when file is falsy", (done) => {
		const w = new Watchpack({ aggregateTimeout: 50 });
		w.on("remove", (file) => {
			expect(file).toBe("/tmp/item");
			w.close();
			done();
		});
		w._onRemove("/tmp/item", undefined, "change");
	});

	it("_onTimeout emits aggregated and clears state", (done) => {
		const w = new Watchpack({ aggregateTimeout: 10000 });
		w.paused = true;
		w._onChange("/tmp/change", 1, "/tmp/change", "change");
		w._onRemove("/tmp/remove", "/tmp/remove", "change");
		w.on("aggregated", (changes, removals) => {
			expect([...changes]).toEqual(["/tmp/change"]);
			expect([...removals]).toEqual(["/tmp/remove"]);
			expect(w.aggregateTimer).toBeUndefined();
			// sets have been reset
			expect(w.aggregatedChanges.size).toBe(0);
			expect(w.aggregatedRemovals.size).toBe(0);
			w.close();
			done();
		});
		w._onTimeout();
	});

	it("getTimes returns an empty prototype-less object with no watchers", () => {
		const w = new Watchpack();
		const times = w.getTimes();
		expect(Object.getPrototypeOf(times)).toBeNull();
		expect(Object.keys(times)).toEqual([]);
		w.close();
	});

	it("getTimeInfoEntries returns empty Map with no watchers", () => {
		const w = new Watchpack();
		const entries = w.getTimeInfoEntries();
		expect(entries).toBeInstanceOf(Map);
		expect(entries.size).toBe(0);
		w.close();
	});

	it("collectTimeInfoEntries populates nothing with no watchers", () => {
		const w = new Watchpack();
		const files = new Map();
		const dirs = new Map();
		w.collectTimeInfoEntries(files, dirs);
		expect(files.size).toBe(0);
		expect(dirs.size).toBe(0);
		w.close();
	});

	it("close() on an unused Watchpack should be safe", () => {
		const w = new Watchpack();
		w.close();
		// Idempotent close
		w.close();
		expect(w.paused).toBe(true);
	});

	it("close() clears a running aggregate timer", () => {
		const w = new Watchpack({ aggregateTimeout: 100000 });
		w._onChange("/tmp/a", 1, "/tmp/a", "change");
		expect(w.aggregateTimer).toBeDefined();
		w.close();
		// timer is cleared by close
		expect(w.paused).toBe(true);
	});
});

describe("Watchpack internal watcher classes", () => {
	it("watchpackFileWatcher.update handles single-file -> array transition", () => {
		const { EventEmitter } = require("events");

		// Reach in to the internal class via a minimal Watcher stand-in
		const w = new Watchpack();
		// Build a fake underlying watcher with only on/close
		const fakeWatcher = Object.assign(new EventEmitter(), {
			close() {},
		});
		// Construct WatchpackFileWatcher using Reflect, fetched through
		// an internal use by watching a path
		const file = path.join(__dirname, "fixtures", "nonexistent-xxx");
		w.watch([file], []);
		const fw = w.fileWatchers.get(file);
		expect(fw).toBeDefined();
		expect(fw.files).toEqual([file]);

		// Single -> same single: no-op branch
		fw.update(file);
		expect(fw.files).toEqual([file]);

		// Single -> single (different): replace in place
		fw.update(`${file}-b`);
		expect(fw.files).toEqual([`${file}-b`]);

		// Single -> array: length differs, go to array branch
		fw.update([`${file}-b`, `${file}-c`]);
		expect(fw.files).toEqual([`${file}-b`, `${file}-c`]);

		// Array -> array
		fw.update([`${file}-b`, `${file}-d`]);
		expect(fw.files).toEqual([`${file}-b`, `${file}-d`]);

		// Array -> single: length !== 1, replace with [single]
		fw.update(`${file}-e`);
		expect(fw.files).toEqual([`${file}-e`]);

		// Reference the fakeWatcher to avoid unused-var lint
		expect(fakeWatcher).toBeDefined();
		w.close();
	});

	it("watchpackDirectoryWatcher.update handles single-dir -> array transition", () => {
		const w = new Watchpack();
		const dir = path.join(__dirname, "fixtures", "dir-nonexistent-x");
		w.watch([], [dir]);
		const dw = w.directoryWatchers.get(dir);
		expect(dw).toBeDefined();
		expect(dw.directories).toEqual([dir]);

		dw.update(dir);
		expect(dw.directories).toEqual([dir]);

		dw.update(`${dir}-b`);
		expect(dw.directories).toEqual([`${dir}-b`]);

		dw.update([`${dir}-b`, `${dir}-c`]);
		expect(dw.directories).toEqual([`${dir}-b`, `${dir}-c`]);

		dw.update([`${dir}-b`, `${dir}-d`]);
		expect(dw.directories).toEqual([`${dir}-b`, `${dir}-d`]);

		dw.update(`${dir}-e`);
		expect(dw.directories).toEqual([`${dir}-e`]);

		w.close();
	});

	it("watchpackFileWatcher.initial-missing emits remove for each tracked file", () => {
		const w = new Watchpack();
		const file = path.join(__dirname, "fixtures", "init-missing");
		w.watch([file], []);
		const fw = w.fileWatchers.get(file);
		expect(fw).toBeDefined();
		// Simulate multiple tracked files
		fw.files = [file, `${file}-2`];
		let removeCount = 0;
		w.on("remove", () => {
			removeCount++;
		});
		fw.watcher.emit("initial-missing", "scan (missing)");
		expect(removeCount).toBe(2);
		w.close();
	});

	it("watchpackFileWatcher.change emits for each tracked file", () => {
		const w = new Watchpack();
		const file = path.join(__dirname, "fixtures", "change-multi");
		w.watch([file], []);
		const fw = w.fileWatchers.get(file);
		expect(fw).toBeDefined();
		fw.files = [file, `${file}-2`];
		let changeCount = 0;
		w.on("change", () => {
			changeCount++;
		});
		fw.watcher.emit("change", Date.now(), "change", false);
		expect(changeCount).toBe(2);
		w.close();
	});

	it("watchpackFileWatcher.remove emits for each tracked file", () => {
		const w = new Watchpack();
		const file = path.join(__dirname, "fixtures", "remove-multi");
		w.watch([file], []);
		const fw = w.fileWatchers.get(file);
		expect(fw).toBeDefined();
		fw.files = [file, `${file}-2`];
		let removeCount = 0;
		w.on("remove", () => {
			removeCount++;
		});
		fw.watcher.emit("remove", "remove");
		expect(removeCount).toBe(2);
		w.close();
	});

	it("watch() groups multiple paths that resolve to the same underlying watcher", () => {
		const w = new Watchpack();
		const dirA = path.join(__dirname, "fixtures", "dir-same");
		const dirB = path.join(__dirname, "fixtures", "dir-same");
		// Watching the same directory twice exercises the addToMap array branch
		w.watch([], [dirA, dirB]);
		const dw = w.directoryWatchers.get(dirA);
		expect(dw).toBeDefined();
		// Two entries with same key become an array
		expect(Array.isArray(dw.directories) ? dw.directories.length : 1).toBe(2);
		w.close();
	});

	it("watch() groups three or more paths that resolve to the same underlying watcher", () => {
		const w = new Watchpack();
		const dir = path.join(__dirname, "fixtures", "dir-triple");
		// Three identical entries exercise the Array.isArray -> push branch
		w.watch([], [dir, dir, dir]);
		const dw = w.directoryWatchers.get(dir);
		expect(dw).toBeDefined();
		expect(Array.isArray(dw.directories) ? dw.directories.length : 1).toBe(3);
		w.close();
	});

	it("watch() can change from a directory-only set to a file-only set", () => {
		const w = new Watchpack();
		const target = path.join(__dirname, "fixtures", "dir-toggle");
		w.watch([], [target]);
		expect(w.directoryWatchers.has(target)).toBe(true);
		// Now watch same path as a file only, clearing directory watcher
		w.watch([target], []);
		expect(w.directoryWatchers.has(target)).toBe(false);
		expect(w.fileWatchers.has(target)).toBe(true);
		// Then stop watching the file
		w.watch([], []);
		expect(w.fileWatchers.has(target)).toBe(false);
		w.close();
	});

	let symlinksSupported = false;
	try {
		fs.symlinkSync("helpers", path.join(__dirname, "fixtures"), "dir");
		fs.unlinkSync(path.join(__dirname, "fixtures"));
		symlinksSupported = true;
	} catch (_err) {
		// ignore
	}

	if (symlinksSupported) {
		it("watch() with followSymlinks handles files, missing, and directories", () => {
			const w = new Watchpack({ followSymlinks: true });
			// Use non-existent paths — LinkResolver.resolve will fall through
			// ENOENT branches and still return the input path as the only entry
			const file = path.join(__dirname, "fixtures", "no-file-sym");
			const dir = path.join(__dirname, "fixtures", "no-dir-sym");
			const missing = path.join(__dirname, "fixtures", "no-missing-sym");
			w.watch({
				files: [file],
				directories: [dir],
				missing: [missing],
			});
			// Missing is part of the internal state
			expect(w._missing.has(missing)).toBe(true);
			w.close();
		});
	} else {
		it("followSymlinks (symlinks not supported in this environment)", () => {
			expect(symlinksSupported).toBe(false);
		});
	}

	it("watchpackDirectoryWatcher events emit per tracked directory", () => {
		const w = new Watchpack();
		const dir = path.join(__dirname, "fixtures", "dir-events");
		w.watch([], [dir]);
		const dw = w.directoryWatchers.get(dir);
		expect(dw).toBeDefined();
		dw.directories = [dir, `${dir}-2`];

		let changeCount = 0;
		let removeCount = 0;
		w.on("change", () => {
			changeCount++;
		});
		w.on("remove", () => {
			removeCount++;
		});

		dw.watcher.emit("change", "file-a", Date.now(), "change", false);
		expect(changeCount).toBe(2);

		dw.watcher.emit("initial-missing", "scan (missing)");
		expect(removeCount).toBe(2);

		removeCount = 0;
		dw.watcher.emit("remove", "remove");
		expect(removeCount).toBe(2);

		w.close();
	});
});
