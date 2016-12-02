/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import watcherManager = require('./watcherManager');

import { EventEmitter } from 'events'
import Watcher = require('./Watcher')
import DirectoryWatcher = require('./DirectoryWatcher')

class Watchpack extends EventEmitter {
    aggregatedChanges: string[]
    aggregateTimeout: NodeJS.Timer // setTimeout id
    dirWatchers: Watcher[]
    fileWatchers: Watcher[]
    mtimes: {
        [path: string]: number
    }
    options: Watchpack.WatchOptions
    paused: boolean
    watcherOptions: Watchpack.WatcherOptions

    constructor(options: Watchpack.WatchOptions) {
        super();
        if (!options) {
            options = {} as any;
        }
        if (!options.aggregateTimeout) {
            options.aggregateTimeout = 200;
        }
        this.options = options;
        this.watcherOptions = {
            ignored: options.ignored,
            poll: options.poll
        };
        this.fileWatchers = [];
        this.dirWatchers = [];
        this.mtimes = {};
        this.paused = false;
        this.aggregatedChanges = [];
        this.aggregateTimeout = null;
        this._onTimeout = this._onTimeout.bind(this);
    }

    watch(files: string[], directories: string[], startTime: number) {
        this.paused = false;
        const oldFileWatchers = this.fileWatchers;
        const oldDirWatchers = this.dirWatchers;
        this.fileWatchers = files.map(function (file) {
            return this._fileWatcher(file, watcherManager.watchFile(file, this.watcherOptions, startTime));
        }, this);
        this.dirWatchers = directories.map(function (dir) {
            return this._dirWatcher(dir, watcherManager.watchDirectory(dir, this.watcherOptions, startTime));
        }, this);
        oldFileWatchers.forEach(w => {
            w.close();
        }, this);
        oldDirWatchers.forEach(w => {
            w.close();
        }, this);
    }

    close() {
        this.paused = true;
        if (this.aggregateTimeout) {
            clearTimeout(this.aggregateTimeout);
        }
        this.fileWatchers.forEach(w => {
            w.close();
        }, this);
        this.dirWatchers.forEach(w => {
            w.close();
        }, this);
        this.fileWatchers.length = 0;
        this.dirWatchers.length = 0;
    }

    pause() {
        this.paused = true;
        if (this.aggregateTimeout) {
            clearTimeout(this.aggregateTimeout);
        }
    }

    getTimes() {
        const directoryWatchers: DirectoryWatcher[] = [];
        addWatchersToArray(this.fileWatchers.concat(this.dirWatchers), directoryWatchers);
        const obj = {};
        directoryWatchers.forEach(w => {
            const times = w.getTimes();
            Object.keys(times).forEach(file => {
                obj[file] = times[file];
            });
        });
        return obj;
    }

    _fileWatcher(file: string, watcher: Watcher) {
        watcher.on('change', this._onChange.bind(this, file));
        return watcher;
    }

    _dirWatcher(item: string, watcher: Watcher) {
        watcher.on('change', (file: string, mtime: number) => {
            this._onChange(item, mtime, file);
        });
        return watcher;
    }

    _onChange(item: string, mtime: number, file = item) {
        this.mtimes[file] = mtime;
        if (this.paused) {
            return;
        }
        this.emit('change', file, mtime);
        if (this.aggregateTimeout) {
            clearTimeout(this.aggregateTimeout);
        }
        if (!this.aggregatedChanges.includes(item)) {
            this.aggregatedChanges.push(item);
        }
        this.aggregateTimeout = setTimeout(this._onTimeout, this.options.aggregateTimeout);
    }

    _onTimeout() {
        this.aggregateTimeout = null;
        const changes = this.aggregatedChanges;
        this.aggregatedChanges = [];
        this.emit('aggregated', changes);
    }
}

declare namespace Watchpack {
    interface WatcherOptions {
        ignored?: string[] | string | RegExp | ((path: string)=> boolean)
        poll?: boolean | number
    }

    interface WatchOptions extends WatcherOptions {
        aggregateTimeout?: number
    }
}

export = Watchpack;

function addWatchersToArray(watchers: Watcher[], array: any[]) {
    watchers.forEach(w => {
        if (!array.includes(w.directoryWatcher)) {
            array.push(w.directoryWatcher);
            addWatchersToArray(Object.keys(w.directoryWatcher.directories).reduce((a, dir) => {
                if (w.directoryWatcher.directories[dir] !== true) {
                    a.push(w.directoryWatcher.directories[dir]);
                }
                return a;
            }, []), array);
        }
    });
}
