/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const fs = require("graceful-fs");
const path = require("path");

let DirectoryWatcher;

class WatcherManager {
	constructor(fileSystem) {
		this.fileSystem = fileSystem || fs;
		this.directoryWatchers = new Map();
	}

	getDirectoryWatcher(directory, options) {
		if(DirectoryWatcher === undefined) {
			DirectoryWatcher = require("./DirectoryWatcher");
		}
		options = options || {};
		const key = directory + " " + JSON.stringify(options);
		const watcher = this.directoryWatchers.get(key);
		if(watcher === undefined) {
			const newWatcher = new DirectoryWatcher(directory, options, this);
			this.directoryWatchers.set(key, newWatcher);
			newWatcher.on("closed", () => {
				this.directoryWatchers.delete(key);
			});
			return newWatcher;
		}
		return watcher;
	}

	watchFile(p, options, startTime) {
		const directory = path.dirname(p);
		return this.getDirectoryWatcher(directory, options).watch(p, startTime);
	}

	watchDirectory(directory, options, startTime) {
		return this.getDirectoryWatcher(directory, options).watch(directory, startTime);
	}
}

module.exports = WatcherManager;
