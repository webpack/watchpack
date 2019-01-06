/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

var EventEmitter = require("events").EventEmitter;
var async = require("neo-async");
var fs = require("graceful-fs");
var path = require("path");

var watcherManager = require("./watcherManager");

var FS_ACCURACY = 1000;

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
		if(typeof this.startTime !== "number") return !initial;
		var startTime = this.startTime;
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
		this.files = Object.create(null);
		this.directories = Object.create(null);
		this.initialScan = true;
		this.nestedWatching = false;
		this.initialScanRemoved = new Set();
		this.watchers = Object.create(null);
		this.parentWatcher = null;
		this.refs = 0;
		this._activeEvents = new Map();
		this.closed = false;

		this.createWatcher();
		this.doInitialScan();
	}

	createWatcher() {
		if(IS_OSX) {
			this.watchInParentDirectory();
		}
		try {
			const options = this.options;
			var interval = typeof options.poll === "number" ? options.poll : undefined;
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

	setMissing(itemPath, initial, type) {
		if(this.initialScan) {
			this.initialScanRemoved.add(itemPath);
		}

		var oldDirectory = this.directories[itemPath];
		if(oldDirectory) {
			if(this.nestedWatching)
				this.directories[itemPath].close();
			delete this.directories[itemPath];
			if(this.watchers[withoutCase(itemPath)]) {
				this.watchers[withoutCase(itemPath)].forEach(function(w) {
					w.emit("remove", type);
				});
			}
			if(!initial && this.watchers[withoutCase(this.path)]) {
				this.watchers[withoutCase(this.path)].forEach(function(w) {
					w.emit("change", itemPath, null, type);
				});
			}
		}

		var oldFile = this.files[itemPath];
		if(oldFile) {
			var now = Date.now();
			this.files[itemPath] = [now, null];

			if(this.watchers[withoutCase(itemPath)]) {
				this.watchers[withoutCase(itemPath)].forEach(function(w) {
					w.emit("remove", type);
				});
			}
			if(this.watchers[withoutCase(this.path)]) {
				this.watchers[withoutCase(this.path)].forEach(function(w) {
					w.emit("change", itemPath, null, type);
				});
			}
		}
	}

	setFileTime(filePath, mtime, initial, type) {
		var now = Date.now();
		var old = this.files[filePath];

		this.files[filePath] = [initial ? Math.min(now, mtime) : now, mtime];

		// we add the fs accuracy to reach the maximum possible mtime
		mtime = mtime + FS_ACCURACY;

		if(!old) {
			if(this.watchers[withoutCase(filePath)]) {
				this.watchers[withoutCase(filePath)].forEach(function(w) {
					if(!initial || w.checkStartTime(mtime, initial)) {
						w.emit("change", mtime, type);
					}
				});
			}
		} else if(!initial) {
			if(this.watchers[withoutCase(filePath)]) {
				this.watchers[withoutCase(filePath)].forEach(function(w) {
					w.emit("change", mtime, type);
				});
			}
		}
		if(this.watchers[withoutCase(this.path)]) {
			this.watchers[withoutCase(this.path)].forEach(function(w) {
				if(!initial || w.checkStartTime(mtime, initial)) {
					w.emit("change", filePath, mtime, type);
				}
			});
		}
	}

	setDirectory(directoryPath, mtime, initial, type) {
		if(directoryPath === this.path) {
			if(!initial && this.watchers[withoutCase(this.path)]) {
				this.watchers[withoutCase(this.path)].forEach(function(w) {
					w.emit("change", directoryPath, mtime, type);
				});
			}
		} else {
			var old = this.directories[directoryPath];
			if(!old) {
				if(this.nestedWatching) {
					this.createNestedWatcher(directoryPath);
				} else {
					this.directories[directoryPath] = true;
				}
				if(!initial && this.watchers[withoutCase(this.path)]) {
					this.watchers[withoutCase(this.path)].forEach(function(w) {
						w.emit("change", directoryPath, mtime, type);
					});
				}
				if(this.watchers[withoutCase(directoryPath)]) {
					this.watchers[withoutCase(directoryPath)].forEach(function(w) {
						if(!initial || w.checkStartTime(mtime, false)) {
							w.emit("change", mtime, type);
						}
					});
				}
			}
		}
	}

	createNestedWatcher(directoryPath) {
		this.directories[directoryPath] = watcherManager.watchDirectory(directoryPath, this.options, 1);
		this.directories[directoryPath].on("change", function(filePath, mtime, type) {
			if(this.watchers[withoutCase(this.path)]) {
				this.watchers[withoutCase(this.path)].forEach(function(w) {
					if(w.checkStartTime(mtime, false)) {
						w.emit("change", filePath, mtime, type);
					}
				});
			}
		}.bind(this));
	}

	setNestedWatching(flag) {
		if(this.nestedWatching !== !!flag) {
			this.nestedWatching = !!flag;
			if(this.nestedWatching) {
				Object.keys(this.directories).forEach(function(directory) {
					this.createNestedWatcher(directory);
				}, this);
			} else {
				Object.keys(this.directories).forEach(function(directory) {
					this.directories[directory].close();
					this.directories[directory] = true;
				}, this);
			}
		}
	}

	watch(filePath, startTime) {
		this.watchers[withoutCase(filePath)] = this.watchers[withoutCase(filePath)] || [];
		this.refs++;
		var watcher = new Watcher(this, filePath, startTime);
		watcher.on("closed", function() {
			var idx = this.watchers[withoutCase(filePath)].indexOf(watcher);
			this.watchers[withoutCase(filePath)].splice(idx, 1);
			if(this.watchers[withoutCase(filePath)].length === 0) {
				delete this.watchers[withoutCase(filePath)];
				if(this.path === filePath)
					this.setNestedWatching(false);
			}
			if(--this.refs <= 0)
				this.close();
		}.bind(this));
		this.watchers[withoutCase(filePath)].push(watcher);
		var data;
		if(filePath === this.path) {
			this.setNestedWatching(true);
			data = false;
			Object.keys(this.files).forEach(function(file) {
				var d = this.files[file];
				if(!data)
					data = d;
				else
					data = [Math.max(data[0], d[0]), Math.max(data[1], d[1])];
			}, this);
		} else {
			data = this.files[filePath];
		}
		process.nextTick(function() {
			if(this.closed) return;
			if(data) {
				var ts = data[0] === data[1] ? data[0] + FS_ACCURACY : data[0];
				if(ts >= startTime)
					watcher.emit("change", data[1]);
			} else if(this.initialScan && this.initialScanRemoved.has(filePath)) {
				watcher.emit("remove");
			}
		}.bind(this));
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
		for(const directory of Object.keys(this.directories)) {
			this.setMissing(directory, false, "directory-removed");
		}
		for(const file of Object.keys(this.files)) {
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

					// directory was created so we emit a event
					if(this.watchers[withoutCase(this.path)]) {
						this.watchers[withoutCase(this.path)].forEach(function(w) {
							w.emit("change", this.path, mtime, type);
						}, this);
					}
				}
			});
			this.parentWatcher.on("remove", () => {
				this.onDirectoryRemoved();
			});
		}
	}

	doInitialScan() {
		fs.readdir(this.path, (err, items) => {
			if(!this.initialScan) return;
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
				var itemPath = path.join(this.path, item);
				fs.stat(itemPath, (err2, stats) => {
					if(!this.initialScan) return;
					if(err2) {
						if(err2.code === "ENOENT" || err2.code === "EPERM") {
							this.setMissing(itemPath, true, "initial-scan (" + err2.code + ")")
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
						if(!this.files[itemPath])
							this.setFileTime(itemPath, +stats.mtime || +stats.ctime || 1, true, "initial-scan (file)");
					} else if(stats.isDirectory()) {
						if(!this.directories[itemPath])
							this.setDirectory(itemPath, +stats.mtime || +stats.ctime || 1, true, "initial-scan (dir)");
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
		var obj = Object.create(null);
		var selfTime = 0;
		Object.keys(this.files).forEach(function(file) {
			var data = this.files[file];
			var time;
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
		}, this);
		if(this.nestedWatching) {
			Object.keys(this.directories).forEach(function(dir) {
				var w = this.directories[dir];
				var times = w.directoryWatcher.getTimes();
				Object.keys(times).forEach(function(file) {
					var time = times[file];
					obj[file] = time;
					if(time > selfTime)
						selfTime = time;
				});
			}, this);
			obj[this.path] = selfTime;
		}
		Object.keys(this.watchers).forEach(key => {
			this.watchers[key].forEach(watcher => {
				const path = watcher.path;
				if(!Object.prototype.hasOwnProperty.call(obj, path)) {
					obj[path] = null;
				}
			});
		});
		return obj;
	}

	getTimeInfoEntries() {
		var obj = Object.create(null);
		var selfTime = 0;
		Object.keys(this.files).forEach(function(file) {
			var data = this.files[file];
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
		}, this);
		if(this.nestedWatching) {
			Object.keys(this.directories).forEach(function(dir) {
				var w = this.directories[dir];
				var timeInfoEntries = w.directoryWatcher.getTimeInfoEntries();
				Object.keys(timeInfoEntries).forEach(function(file) {
					var time = timeInfoEntries[file];
					obj[file] = time;
					if(time && time.safeTime > selfTime)
						selfTime = time.safeTime;
				});
			}, this);
			obj[this.path] = {
				safeTime: selfTime
			};
		}
		Object.keys(this.watchers).forEach(key => {
			this.watchers[key].forEach(watcher => {
				const path = watcher.path;
				if(!Object.prototype.hasOwnProperty.call(obj, path)) {
					obj[path] = null;
				}
			});
		});
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
			Object.keys(this.directories).forEach(function(dir) {
				this.directories[dir].close();
			}, this);
			this.directories = {};
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
