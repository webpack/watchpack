"use strict";

const path = require("path");
const getWatcherManager = require("../lib/getWatcherManager");

describe("getWatcherManager", () => {
	it("should cache the WatcherManager for a given options reference", () => {
		const options = { followSymlinks: false };
		const wm1 = getWatcherManager(options);
		const wm2 = getWatcherManager(options);
		expect(wm2).toBe(wm1);
	});

	it("should create a new WatcherManager for a new options reference", () => {
		const wm1 = getWatcherManager({});
		const wm2 = getWatcherManager({});
		expect(wm2).not.toBe(wm1);
	});

	it("watcherManager constructor defaults options to an empty object", () => {
		const { WatcherManager } = getWatcherManager;
		const wm = new WatcherManager();
		expect(wm.options).toEqual({});
		expect(wm.directoryWatchers).toBeInstanceOf(Map);
	});

	it("watchFile returns null when the file is its own directory (filesystem root)", () => {
		const { WatcherManager } = getWatcherManager;
		const wm = new WatcherManager({});
		const { root } = path.parse(process.cwd());
		expect(wm.watchFile(root)).toBeNull();
	});
});
