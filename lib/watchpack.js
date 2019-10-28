/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const getWatcherManager = require("./getWatcherManager");
const LinkResolver = require("./LinkResolver");
const EventEmitter = require("events").EventEmitter;
const globToRegExp = require("glob-to-regexp");

let EXISTANCE_ONLY_TIME_ENTRY; // lazy required

function addWatchersToSet(watchers, set) {
	for (const w of watchers) {
		if (w !== true && !set.has(w.directoryWatcher)) {
			set.add(w.directoryWatcher);
			addWatchersToSet(w.directoryWatcher.directories.values(), set);
		}
	}
}

const stringToRegexp = ignored => {
	const source = globToRegExp(ignored, { globstar: true, extended: true })
		.source;
	const matchingStart = source.slice(0, source.length - 1) + "(?:$|\\/)";
	return matchingStart;
};

const ignoredToRegexp = ignored => {
	if (Array.isArray(ignored)) {
		return new RegExp(ignored.map(i => stringToRegexp(i)).join("|"));
	} else if (typeof ignored === "string") {
		return new RegExp(stringToRegexp(ignored));
	} else if (ignored) {
		throw new Error(`Invalid option for 'ignored': ${ignored}`);
	} else {
		return undefined;
	}
};

const normalizeOptions = options => {
	return {
		followSymlinks: !!options.followSymlinks,
		ignored: ignoredToRegexp(options.ignored),
		poll: options.poll
	};
};

const normalizeCache = new WeakMap();
const cachedNormalizeOptions = options => {
	const cacheEntry = normalizeCache.get(options);
	if (cacheEntry !== undefined) return cacheEntry;
	const normalized = normalizeOptions(options);
	normalizeCache.set(options, normalized);
	return normalized;
};

class Watchpack extends EventEmitter {
	constructor(options) {
		super();
		if (!options) options = {};
		if (!options.aggregateTimeout) options.aggregateTimeout = 200;
		this.options = options;
		this.watcherOptions = cachedNormalizeOptions(options);
		this.watcherManager = getWatcherManager(this.watcherOptions);
		this.fileWatchers = [];
		this.dirWatchers = [];
		this.paused = false;
		this.aggregatedChanges = new Set();
		this.aggregatedRemovals = new Set();
		this.aggregateTimeout = 0;
		this._onTimeout = this._onTimeout.bind(this);
	}

	watch(files, directories, startTime) {
		this.paused = false;
		const oldFileWatchers = this.fileWatchers;
		const oldDirWatchers = this.dirWatchers;
		const ignored = this.watcherOptions.ignored;
		const filter = ignored
			? path => !ignored.test(path.replace(/\\/g, "/"))
			: () => true;
		this.fileWatchers = [];
		this.dirWatchers = [];
		if (this.watcherOptions.followSymlinks) {
			const resolver = new LinkResolver();
			for (const file of files) {
				if (filter(file)) {
					for (const innerFile of resolver.resolve(file)) {
						if (file === innerFile || filter(innerFile)) {
							const watcher = this._fileWatcher(
								file,
								this.watcherManager.watchFile(innerFile, startTime)
							);
							if (watcher) this.fileWatchers.push(watcher);
						}
					}
				}
			}
			for (const dir of directories) {
				if (filter(dir)) {
					let first = true;
					for (const innerItem of resolver.resolve(dir)) {
						if (filter(innerItem)) {
							const watcher = this._dirWatcher(
								dir,
								first
									? this.watcherManager.watchDirectory(innerItem, startTime)
									: this.watcherManager.watchFile(innerItem, startTime)
							);
							if (watcher) this.dirWatchers.push(watcher);
						}
						first = false;
					}
				}
			}
		} else {
			for (const file of files) {
				if (filter(file)) {
					const watcher = this._fileWatcher(
						file,
						this.watcherManager.watchFile(file, startTime)
					);
					if (watcher) this.fileWatchers.push(watcher);
				}
			}
			for (const dir of directories) {
				if (filter(dir)) {
					const watcher = this._dirWatcher(
						dir,
						this.watcherManager.watchDirectory(dir, startTime)
					);
					if (watcher) this.dirWatchers.push(watcher);
				}
			}
		}
		for (const w of oldFileWatchers) w.close();
		for (const w of oldDirWatchers) w.close();
	}

	close() {
		this.paused = true;
		if (this.aggregateTimeout) clearTimeout(this.aggregateTimeout);
		for (const w of this.fileWatchers) w.close();
		for (const w of this.dirWatchers) w.close();
		this.fileWatchers.length = 0;
		this.dirWatchers.length = 0;
	}

	pause() {
		this.paused = true;
		if (this.aggregateTimeout) clearTimeout(this.aggregateTimeout);
	}

	getTimes() {
		const directoryWatchers = new Set();
		addWatchersToSet(this.fileWatchers, directoryWatchers);
		addWatchersToSet(this.dirWatchers, directoryWatchers);
		const obj = Object.create(null);
		for (const w of directoryWatchers) {
			const times = w.getTimes();
			for (const file of Object.keys(times)) obj[file] = times[file];
		}
		return obj;
	}

	getTimeInfoEntries() {
		if (EXISTANCE_ONLY_TIME_ENTRY === undefined) {
			EXISTANCE_ONLY_TIME_ENTRY = require("./DirectoryWatcher")
				.EXISTANCE_ONLY_TIME_ENTRY;
		}
		const directoryWatchers = new Set();
		addWatchersToSet(this.fileWatchers, directoryWatchers);
		addWatchersToSet(this.dirWatchers, directoryWatchers);
		const map = new Map();
		for (const w of directoryWatchers) {
			const times = w.getTimeInfoEntries();
			for (const [path, entry] of times) {
				if (map.has(path)) {
					if (entry === EXISTANCE_ONLY_TIME_ENTRY) continue;
					const value = map.get(path);
					if (value === entry) continue;
					if (value !== EXISTANCE_ONLY_TIME_ENTRY) {
						map.set(path, Object.assign({}, value, entry));
						continue;
					}
				}
				map.set(path, entry);
			}
		}
		return map;
	}

	_fileWatcher(file, watcher) {
		if (watcher) {
			watcher.on("change", (mtime, type) => {
				this._onChange(file, mtime, file, type);
			});
			watcher.on("remove", type => {
				this._onRemove(file, file, type);
			});
		}
		return watcher;
	}

	_dirWatcher(item, watcher) {
		watcher.on("change", (file, mtime, type) => {
			this._onChange(item, mtime, file, type);
		});
		return watcher;
	}

	_onChange(item, mtime, file, type) {
		file = file || item;
		if (this.paused) return;
		this.emit("change", file, mtime, type);
		if (this.aggregateTimeout) clearTimeout(this.aggregateTimeout);
		this.aggregatedChanges.add(item);
		this.aggregateTimeout = setTimeout(
			this._onTimeout,
			this.options.aggregateTimeout
		);
	}

	_onRemove(item, file) {
		file = file || item;
		if (this.paused) return;
		this.emit("remove", item);
		if (this.aggregateTimeout) clearTimeout(this.aggregateTimeout);
		this.aggregatedRemovals.add(item);
		this.aggregateTimeout = setTimeout(
			this._onTimeout,
			this.options.aggregateTimeout
		);
	}

	_onTimeout() {
		this.aggregateTimeout = 0;
		const changes = this.aggregatedChanges;
		const removals = this.aggregatedRemovals;
		this.aggregatedChanges = new Set();
		this.aggregatedRemovals = new Set();
		this.emit("aggregated", changes, removals);
	}
}

module.exports = Watchpack;
