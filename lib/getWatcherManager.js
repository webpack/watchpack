/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");
const DirectoryWatcher = require("./DirectoryWatcher");

class WatcherManager {
	constructor(options) {
		this.options = options;
		this.directoryWatchers = new Map();
	}

	getDirectoryWatcher(directory) {
		const watcher = this.directoryWatchers.get(directory);
		if (watcher === undefined) {
			const newWatcher = new DirectoryWatcher(this, directory, this.options);
			this.directoryWatchers.set(directory, newWatcher);
			newWatcher.on("closed", () => {
				this.directoryWatchers.delete(directory);
			});
			return newWatcher;
		}
		return watcher;
	}

	watchFile(file, startTime) {
		const directory = path.dirname(file);
		if (directory === file) return null;
		return this.getDirectoryWatcher(directory).watch(file, startTime);
	}

	watchDirectory(directory, startTime) {
		return this.getDirectoryWatcher(directory).watch(directory, startTime);
	}
}

const watcherManagers = new WeakMap();

/**
 * @param {object} options options
 * @returns {WatcherManager} the watcher manager
 */
module.exports = (options) => {
	const watcherManager = watcherManagers.get(options);
	if (watcherManager !== undefined) return watcherManager;
	const newWatcherManager = new WatcherManager(options);
	watcherManagers.set(options, newWatcherManager);
	return newWatcherManager;
};
module.exports.WatcherManager = WatcherManager;
