/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const EventEmitter = require("events").EventEmitter;
const async = require("neo-async");
const fs = require("graceful-fs");
const path = require("path");

const watcherManager = require("./watcherManager");

let FS_ACCURACY = 1000;

const IS_OSX = require("os").platform() === "darwin";

function withoutCase(str) {
	return str.toLowerCase();
}

class Watcher extends EventEmitter {
	constructor(directoryWatcher, filePath, startTime) {
		super();
		this.directoryWatcher = directoryWatcher;
		this.path = filePath;
		this.startTime = startTime && +startTime;
	}

	checkStartTime(mtime, initial) {
		const startTime = this.startTime;
		if(typeof startTime !== "number") return !initial;
		return startTime <= mtime;
	}

	close() {
		this.emit("closed");
	}
}

class DirectoryWatcher extends EventEmitter {
	constructor(directoryPath, options) {
		super();
		this.options = options;
		this.path = directoryPath;
		this.files = new Map();
		this.directories = new Map();
		this.initialScan = true;
		this.nestedWatching = false;
		this.initialScanRemoved = new Set();
		this.watchers = new Map();
		this.parentWatcher = null;
		this.refs = 0;
		this._activeEvents = new Map();
		this.closed = false;

		this.createWatcher();
		this.doScan(true);
	}

	createWatcher() {
		if(IS_OSX) {
			this.watchInParentDirectory();
		}
		try {
			const options = this.options;
			const interval = typeof options.poll === "number" ? options.poll : undefined;
			// TODO options.poll
			// TODO options.ignored
			this.watcher = fs.watch(this.path);
			this.watcher.on("change", this.onWatchEvent.bind(this));
			//this.watcher.on("add", this.onFileAdded.bind(this));
			//this.watcher.on("addDir", this.onDirectoryAdded.bind(this));
			//this.watcher.on("change", this.onChange.bind(this));
			//this.watcher.on("unlink", this.onFileUnlinked.bind(this));
			//this.watcher.on("unlinkDir", this.onDirectoryUnlinked.bind(this));
			this.watcher.on("error", this.onWatcherError.bind(this));
		} catch(err) {
			this.onWatcherError(err);
		}
	}

	forEachWatcher(path, fn) {
		const watchers = this.watchers.get(withoutCase(path));
		if(watchers !== undefined) {
			for(const w of watchers) {
				fn(w);
			}
		}
	}

	setMissing(itemPath, initial, type) {
		if(this.initialScan) {
			this.initialScanRemoved.add(itemPath);
		}

		const oldDirectory = this.directories.get(itemPath);
		if(oldDirectory) {
			if(this.nestedWatching)
				oldDirectory.close();
			this.directories.delete(itemPath)
			this.forEachWatcher(itemPath, w => w.emit("remove", type));
			if(!initial) {
				this.forEachWatcher(this.path, w => w.emit("change", itemPath, null, type));
			}
		}

		const oldFile = this.files.get(itemPath);
		if(oldFile) {
			const now = Date.now();
			this.files.set(itemPath, [now, null]);

			this.forEachWatcher(itemPath, w => w.emit("remove", type));
			if(!initial) {
				this.forEachWatcher(this.path, w => w.emit("change", itemPath, null, type));
			}
		}
	}

	setFileTime(filePath, mtime, initial, type) {
		const now = Date.now();
		const old = this.files.get(filePath);

		this.files.set(filePath, [initial ? Math.min(now, mtime) : now, mtime]);

		// we add the fs accuracy to reach the maximum possible mtime
		mtime = mtime + FS_ACCURACY;

		if(!old) {
			this.forEachWatcher(filePath, w => {
				if(!initial || w.checkStartTime(mtime, initial)) {
					w.emit("change", mtime, type);
				}
			});
		} else if(!initial) {
			this.forEachWatcher(filePath, w => w.emit("change", mtime, type));
		}
		this.forEachWatcher(this.path, w => {
			if(!initial || w.checkStartTime(mtime, initial)) {
				w.emit("change", filePath, mtime, type);
			}
		});
	}

	setDirectory(directoryPath, mtime, initial, type) {
		if(directoryPath === this.path) {
			if(!initial) {
				this.forEachWatcher(this.path, w => w.emit("change", directoryPath, mtime, type));
			}
		} else {
			const old = this.directories.get(directoryPath);
			if(!old) {
				if(this.nestedWatching) {
					this.createNestedWatcher(directoryPath);
				} else {
					this.directories.set(directoryPath, true);
				}
				if(!initial) {
					this.forEachWatcher(this.path, w => w.emit("change", directoryPath, mtime, type));
				}
				this.forEachWatcher(directoryPath, w => {
					if(!initial || w.checkStartTime(mtime, false)) {
						w.emit("change", mtime, type);
					}
				});
			}
		}
	}

	createNestedWatcher(directoryPath) {
		const watcher = watcherManager.watchDirectory(directoryPath, this.options, 1);
		watcher.on("change", (filePath, mtime, type) => {
			this.forEachWatcher(this.path, w => {
				if(w.checkStartTime(mtime, false)) {
					w.emit("change", filePath, mtime, type);
				}
			});
		});
		this.directories.set(directoryPath, watcher);
	}

	setNestedWatching(flag) {
		if(this.nestedWatching !== !!flag) {
			this.nestedWatching = !!flag;
			if(this.nestedWatching) {
				for(const directory of this.directories.keys()) {
					this.createNestedWatcher(directory);
				}
			} else {
				for(const [directory, watcher] of this.directories) {
					watcher.close();
					this.directories.set(directory, true);
				}
			}
		}
	}

	watch(filePath, startTime) {
		const key = withoutCase(filePath);
		let watchers = this.watchers.get(key);
		if(watchers === undefined) {
			watchers = new Set();
			this.watchers.set(key, watchers);
		}
		this.refs++;
		const watcher = new Watcher(this, filePath, startTime);
		watcher.on("closed", () => {
			watchers.delete(watcher);
			if(watchers.size === 0) {
				this.watchers.delete(key);
				if(this.path === filePath)
					this.setNestedWatching(false);
			}
			if(--this.refs <= 0)
				this.close();
		});
		watchers.add(watcher);
		let data;
		if(filePath === this.path) {
			this.setNestedWatching(true);
			data = false;
			for(const d of this.files.values()) {
				if(!data)
					data = d;
				else
					data = [Math.max(data[0], d[0]), Math.max(data[1], d[1])];
			}
		} else {
			data = this.files.get(filePath);
		}
		process.nextTick(() => {
			if(this.closed) return;
			if(data) {
				const ts = data[0] === data[1] ? data[0] + FS_ACCURACY : data[0];
				if(ts >= startTime)
					watcher.emit("change", data[1]);
			} else if(this.initialScan && this.initialScanRemoved.has(filePath)) {
				watcher.emit("remove");
			}
		});
		return watcher;
	}

	onWatchEvent(eventType, filename) {
		if(this.closed) return;
		if(this._activeEvents.get(filename) === undefined) {
			this._activeEvents.set(filename, false);
			const checkStats = () => {
				if(this.closed) return;
				this._activeEvents.set(filename, false);
				const filePath = path.join(this.path, filename);
				fs.stat(filePath, (err, stats) => {
					if(this.closed) return;
					if(this._activeEvents.get(filename) === true) {
						process.nextTick(checkStats);
						return;
					}
					this._activeEvents.delete(filename);
					// ENOENT happens when the file/directory doesn't exist
					// EPERM happens when the containing directory doesn't exist
					if(err) {
						if(err.code !== "ENOENT" && err.code !== "EPERM") {
							this.onStatsError(err);
						} else {
							if(filename === path.basename(this.path)) {
								// This may indicate that the directory itself was removed
								if(!fs.existsSync(this.path)) {
									this.onDirectoryRemoved();
								}
							}
						}
					}
					if(!stats) {
						this.setMissing(filePath, false, eventType);
					} else if(stats.isDirectory()) {
						this.setDirectory(filePath, +stats.mtime || +stats.ctime || 1, false, eventType);
					} else {
						if(stats.mtime) {
							ensureFsAccuracy(stats.mtime);
						}
						this.setFileTime(filePath, +stats.mtime || +stats.ctime || 1, false, eventType);
					}
				});
			};
			process.nextTick(checkStats);
		} else {
			this._activeEvents.set(filename, true);
		}
	}

	onWatcherError(err) {
		if(err) {
			if(err.code !== "EPERM" && err.code !== "ENOENT") {
				console.error("Watchpack Error (watcher): " + err);
			}
			this.onDirectoryRemoved();
		}
	}

	onStatsError(err) {
		if(err) {
			console.error("Watchpack Error (stats): " + err);
		}
	}

	onScanError(err) {
		if(err) {
			console.error("Watchpack Error (initial scan): " + err);
		}
	}

	onDirectoryRemoved() {
		if(this.watcher) {
			this.watcher.close(),
			this.watcher = null;
		}
		this.watchInParentDirectory();
		for(const directory of this.directories.keys()) {
			this.setMissing(directory, false, "directory-removed");
		}
		for(const file of this.files.keys()) {
			this.setMissing(file, false, "directory-removed");
		}
	}

	watchInParentDirectory() {
		if(!this.parentWatcher) {
			const parentDir = path.dirname(this.path);
			// avoid watching in the root directory
			// removing directories in the root directory is not supported
			if(path.dirname(parentDir) === parentDir) return;

			this.parentWatcher = watcherManager.watchFile(this.path, this.options, 1);
			this.parentWatcher.on("change", (mtime, type) => {
				if(this.closed) return;

				// On non-osx platforms we don't need this watcher to detect
				// directory removal, as a EPERM error indicates that
				if(!IS_OSX && this.parentWatcher) {
					this.parentWatcher.close();
					this.parentWatcher = null;
				}
				// Try to create the watcher when parent directory is found
				if(!this.watcher) {
					this.createWatcher();
					this.doScan(false);

					// directory was created so we emit a event
					this.forEachWatcher(this.path, w => w.emit("change", this.path, mtime, type));
				}
			});
			this.parentWatcher.on("remove", () => {
				this.onDirectoryRemoved();
			});
		}
	}

	doScan(initial) {
		fs.readdir(this.path, (err, items) => {
			if(this.closed) return;
			if(err) {
				if(err.code === "ENOENT" || err.code === "EPERM") {
					this.watchInParentDirectory();
				} else {
					this.onScanError(err);
				}
				this.initialScan = false;
				return;
			}
			async.forEach(items, (item, callback) => {
				const itemPath = path.join(this.path, item);
				fs.stat(itemPath, (err2, stats) => {
					if(this.closed) return;
					if(err2) {
						if(err2.code === "ENOENT" || err2.code === "EPERM") {
							this.setMissing(itemPath, initial, "scan (" + err2.code + ")")
						} else {
							this.onScanError(err2);
						}
						callback();
						return;
					}
					if(stats.isFile()) {
						if(stats.mtime) {
							ensureFsAccuracy(stats.mtime);
						}
						if(!initial || !this.files.has(itemPath))
							this.setFileTime(itemPath, +stats.mtime || +stats.ctime || 1, initial, "scan (file)");
					} else if(stats.isDirectory()) {
						if(!initial || !this.directories.has(itemPath))
							this.setDirectory(itemPath, +stats.mtime || +stats.ctime || 1, initial, "scan (dir)");
					}
					callback();
				});
			}, () => {
				this.initialScan = false;
				this.initialScanRemoved = null;
			});
		});
	}

	getTimes() {
		const obj = Object.create(null);
		let selfTime = 0;
		for(const [file, data] of this.files) {
			let time;
			if(data[1]) {
				time = Math.max(data[0], data[1] + FS_ACCURACY);
				if(time > selfTime)
					selfTime = time;
			} else {
				time = null;
				if(data[0] > selfTime)
					selfTime = data[0];
			}
			obj[file] = time;
		}
		if(this.nestedWatching) {
			for(const w of this.directories.values()) {
				const times = w.directoryWatcher.getTimes();
				Object.keys(times).forEach(function(file) {
					const time = times[file];
					obj[file] = time;
					if(time > selfTime)
						selfTime = time;
				});
			}
			obj[this.path] = selfTime;
		}
		for(const watchers of this.watchers.values()) {
			for(const watcher of watchers) {
				const path = watcher.path;
				if(!Object.prototype.hasOwnProperty.call(obj, path)) {
					obj[path] = null;
				}
			}
		}
		return obj;
	}

	getTimeInfoEntries() {
		const obj = Object.create(null);
		let selfTime = 0;
		for(const [file, data] of this.files) {
			if(data[1]) {
				const safeTime = Math.max(data[0], data[1] + FS_ACCURACY);
				if(safeTime > selfTime)
					selfTime = safeTime;
				obj[file] = {
					safeTime,
					timestamp: data[1]
				};
			} else {
				time = null;
				if(data[0] > selfTime)
					selfTime = data[0];
				obj[file] = null;
			}
		}
		if(this.nestedWatching) {
			for(const w of this.directories.values()) {
				const timeInfoEntries = w.directoryWatcher.getTimeInfoEntries();
				Object.keys(timeInfoEntries).forEach(function(file) {
					const time = timeInfoEntries[file];
					obj[file] = time;
					if(time && time.safeTime > selfTime)
						selfTime = time.safeTime;
				});
			}
			obj[this.path] = {
				safeTime: selfTime
			};
		}
		for(const watchers of this.watchers.values()) {
			for(const watcher of watchers) {
				const path = watcher.path;
				if(!Object.prototype.hasOwnProperty.call(obj, path)) {
					obj[path] = null;
				}
			}
		}
		return obj;
	}

	close() {
		this.closed = true;
		this.initialScan = false;
		if(this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
		if(this.nestedWatching) {
			for(const w of this.directories.values()) {
				w.close();
			}
			this.directories.clear();
		}
		if(this.parentWatcher) {
			this.parentWatcher.close();
			this.parentWatcher = null;
		}
		this.emit("closed");
	}
}

module.exports = DirectoryWatcher;

function ensureFsAccuracy(mtime) {
	if(!mtime) return;
	if(FS_ACCURACY > 1 && mtime % 1 !== 0)
		FS_ACCURACY = 1;
	else if(FS_ACCURACY > 10 && mtime % 10 !== 0)
		FS_ACCURACY = 10;
	else if(FS_ACCURACY > 100 && mtime % 100 !== 0)
		FS_ACCURACY = 100;
}
