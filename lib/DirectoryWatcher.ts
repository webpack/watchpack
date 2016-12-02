/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import { EventEmitter } from 'events';
import async = require('async');
import chokidar = require('chokidar');
import fs = require('graceful-fs');
import path = require('path');
import watcherManager = require('./watcherManager');
import Watcher = require('./Watcher')
import Watchpack = require('./watchpack')

let FS_ACCURENCY = 10000;

function withoutCase(str: string) {
    return str.toLowerCase();
}

class DirectoryWatcher extends EventEmitter {
    directories: {
        [path: string]: Watcher | true
    }
    files: {
        [path: string]: [number, number]
    }
    initialScan: boolean
    initialScanRemoved: string[]
    nestedWatching: boolean
    path: string
    refs: number
    watcher: fs.FSWatcher
    watchers: {
        [path: string]: Watcher[]
    }

    constructor(directoryPath: string, public options: Watchpack.WatcherOptions) {
        super();
        this.path = directoryPath;
        this.files = {};
        this.directories = {};
        this.watcher = chokidar.watch(directoryPath, {
            ignoreInitial: true,
            persistent: true,
            followSymlinks: false,
            depth: 0,
            atomic: false,
            alwaysStat: true,
            ignorePermissionErrors: true,
            ignored: options.ignored,
            usePolling: options.poll ? true : undefined,
            interval: typeof options.poll === 'number' ? options.poll : undefined
        });
        this.watcher.on('add', this.onFileAdded.bind(this));
        this.watcher.on('addDir', this.onDirectoryAdded.bind(this));
        this.watcher.on('change', this.onChange.bind(this));
        this.watcher.on('unlink', this.onFileUnlinked.bind(this));
        this.watcher.on('unlinkDir', this.onDirectoryUnlinked.bind(this));
        this.watcher.on('error', this.onWatcherError.bind(this));
        this.initialScan = true;
        this.nestedWatching = false;
        this.initialScanRemoved = [];
        this.doInitialScan();
        this.watchers = {};
        this.refs = 0;
    }

    setFileTime(filePath: string, mtime: number, initial: boolean, type?: string | boolean) {
        const now = Date.now();
        const old = this.files[filePath];

        this.files[filePath] = [initial ? Math.min(now, mtime) : now, mtime];

        // we add the fs accurency to reach the maximum possible mtime
        mtime = mtime + FS_ACCURENCY;

        if (!old) {
            if (mtime) {
                if (this.watchers[withoutCase(filePath)]) {
                    this.watchers[withoutCase(filePath)].forEach(w => {
                        if (!initial || w.checkStartTime(mtime, initial)) {
                            w.emit('change', mtime);
                        }
                    });
                }
            }
        }
        else if (!initial && mtime && type !== 'add') {
            if (this.watchers[withoutCase(filePath)]) {
                this.watchers[withoutCase(filePath)].forEach(w => {
                    w.emit('change', mtime);
                });
            }
        }
        else if (!initial && !mtime) {
            delete this.files[filePath];
            if (this.watchers[withoutCase(filePath)]) {
                this.watchers[withoutCase(filePath)].forEach(w => {
                    w.emit('remove');
                });
            }
        }
        if (this.watchers[withoutCase(this.path)]) {
            this.watchers[withoutCase(this.path)].forEach(w => {
                if (!initial || w.checkStartTime(mtime, initial)) {
                    w.emit('change', filePath, mtime);
                }
            });
        }
    }

    setDirectory(directoryPath: string, exist: boolean, initial: boolean) {
        const old = this.directories[directoryPath];
        if (!old) {
            if (exist) {
                if (this.nestedWatching) {
                    this.createNestedWatcher(directoryPath);
                }
                else {
                    this.directories[directoryPath] = true;
                }
            }
        }
        else {
            if (!exist) {
                if (this.nestedWatching) {
                    (this.directories[directoryPath] as Watcher).close();
                }
                delete this.directories[directoryPath];
                if (!initial && this.watchers[withoutCase(this.path)]) {
                    this.watchers[withoutCase(this.path)].forEach(w => {
                        w.emit('change', directoryPath, w.data);
                    });
                }
            }
        }
    }

    createNestedWatcher(directoryPath: string) {
        this.directories[directoryPath] = watcherManager.watchDirectory(directoryPath, this.options, 1);
        (this.directories[directoryPath] as Watcher).on('change', (filePath: string, mtime: number) => {
            if (this.watchers[withoutCase(this.path)]) {
                this.watchers[withoutCase(this.path)].forEach(w => {
                    if (w.checkStartTime(mtime, false)) {
                        w.emit('change', filePath, mtime);
                    }
                });
            }
        });
    }

    setNestedWatching(flag: boolean) {
        if (this.nestedWatching !== !!flag) {
            this.nestedWatching = !!flag;
            if (this.nestedWatching) {
                Object.keys(this.directories).forEach(function (directory) {
                    this.createNestedWatcher(directory);
                }, this);
            }
            else {
                Object.keys(this.directories).forEach(function (directory) {
                    this.directories[directory].close();
                    this.directories[directory] = true;
                }, this);
            }
        }
    }

    watch(filePath: string, startTime: number) {
        this.watchers[withoutCase(filePath)] = this.watchers[withoutCase(filePath)] || [];
        this.refs++;
        const watcher = new Watcher(this, filePath, startTime);
        watcher.on('closed', () => {
            const idx = this.watchers[withoutCase(filePath)].indexOf(watcher);
            this.watchers[withoutCase(filePath)].splice(idx, 1);
            if (this.watchers[withoutCase(filePath)].length === 0) {
                delete this.watchers[withoutCase(filePath)];
                if (this.path === filePath) {
                    this.setNestedWatching(false);
                }
            }
            if (--this.refs <= 0) {
                this.close();
            }
        });
        this.watchers[withoutCase(filePath)].push(watcher);
        let data: [number, number] | boolean;
        if (filePath === this.path) {
            this.setNestedWatching(true);
            data = false;
            Object.keys(this.files).forEach(function (file) {
                const d = this.files[file];
                if (!data) {
                    data = d;
                }
                else {
                    data = [Math.max(data[0], d[0]), Math.max(data[1], d[1])];
                }
            }, this);
        }
        else {
            data = this.files[filePath];
        }
        process.nextTick(() => {
            if (data) {
                const ts = data[0] === data[1] ? data[0] + FS_ACCURENCY : data[0];
                if (ts > startTime) {
                    watcher.emit('change', data[1] + FS_ACCURENCY);
                }
            }
            else if (this.initialScan && this.initialScanRemoved.includes(filePath)) {
                watcher.emit('remove');
            }
        });
        return watcher;
    }

    onFileAdded(filePath: string, stat: fs.Stats) {
        if (filePath.indexOf(this.path) !== 0) {
            return;
        }
        if (/[\\\/]/.test(filePath.substr(this.path.length + 1))) {
            return;
        }

        this.setFileTime(filePath, +stat.mtime, false, 'add');
    }

    onDirectoryAdded(directoryPath: string /*, stat */) {
        if (directoryPath.indexOf(this.path) !== 0) {
            return;
        }
        if (/[\\\/]/.test(directoryPath.substr(this.path.length + 1))) {
            return;
        }
        this.setDirectory(directoryPath, true, false);
    }

    onChange(filePath: string, stat: fs.Stats) {
        if (filePath.indexOf(this.path) !== 0) {
            return;
        }
        if (/[\\\/]/.test(filePath.substr(this.path.length + 1))) {
            return;
        }
        const mtime = +stat.mtime;
        if (FS_ACCURENCY > 1 && mtime % 1 !== 0) {
            FS_ACCURENCY = 1;
        }
        else if (FS_ACCURENCY > 10 && mtime % 10 !== 0) {
            FS_ACCURENCY = 10;
        }
        else if (FS_ACCURENCY > 100 && mtime % 100 !== 0) {
            FS_ACCURENCY = 100;
        }
        else if (FS_ACCURENCY > 1000 && mtime % 1000 !== 0) {
            FS_ACCURENCY = 1000;
        }
        else if (FS_ACCURENCY > 2000 && mtime % 2000 !== 0) {
            FS_ACCURENCY = 2000;
        }
        this.setFileTime(filePath, mtime, false, 'change');
    }

    onFileUnlinked(filePath: string) {
        if (filePath.indexOf(this.path) !== 0) {
            return;
        }
        if (/[\\\/]/.test(filePath.substr(this.path.length + 1))) {
            return;
        }
        this.setFileTime(filePath, null, false, 'unlink');
        if (this.initialScan) {
            this.initialScanRemoved.push(filePath);
        }
    }

    onDirectoryUnlinked(directoryPath: string) {
        if (directoryPath.indexOf(this.path) !== 0) {
            return;
        }
        if (/[\\\/]/.test(directoryPath.substr(this.path.length + 1))) {
            return;
        }
        this.setDirectory(directoryPath, false, false);
        if (this.initialScan) {
            this.initialScanRemoved.push(directoryPath);
        }
    }

    onWatcherError() /* err */ {}

    doInitialScan() {
        fs.readdir(this.path, (err, items) => {
            if (err) {
                this.initialScan = false;
                return;
            }
            async.forEach(items, (item, callback) => {
                const itemPath = path.join(this.path, item);
                fs.stat(itemPath, (err2, stat) => {
                    if (!this.initialScan) {
                        return;
                    }
                    if (err2) {
                        callback();
                        return;
                    }
                    if (stat.isFile()) {
                        if (!this.files[itemPath]) {
                            this.setFileTime(itemPath, +stat.mtime, true);
                        }
                    }
                    else if (stat.isDirectory()) {
                        if (!this.directories[itemPath]) {
                            this.setDirectory(itemPath, true, true);
                        }
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
        const obj = {};
        let selfTime = 0;
        Object.keys(this.files).forEach(function (file) {
            const data = this.files[file];
            if (data[1]) {
                const time = Math.max(data[0], data[1] + FS_ACCURENCY);
                obj[file] = time;
                if (time > selfTime) {
                    selfTime = time;
                }
            }
        }, this);
        if (this.nestedWatching) {
            Object.keys(this.directories).forEach(function (dir) {
                const w = this.directories[dir];
                const times = w.directoryWatcher.getTimes();
                Object.keys(times).forEach(file => {
                    const time = times[file];
                    obj[file] = time;
                    if (time > selfTime) {
                        selfTime = time;
                    }
                });
            }, this);
            obj[this.path] = selfTime;
        }
        return obj;
    }

    close() {
        this.initialScan = false;
        this.watcher.close();
        if (this.nestedWatching) {
            Object.keys(this.directories).forEach(function (dir) {
                this.directories[dir].close();
            }, this);
        }
        this.emit('closed');
    }
}

export = DirectoryWatcher;
