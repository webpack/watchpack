/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
import path = require('path');
import DirectoryWatcher = require('./DirectoryWatcher')
import Watchpack = require('./watchpack')

class WatcherManager {
    directoryWatchers: {
        [key: string]: DirectoryWatcher
    }

    constructor() {
        this.directoryWatchers = {};
    }

    getDirectoryWatcher(directory: string, options: Watchpack.WatcherOptions) {
        const DirectoryWatcher = require('./DirectoryWatcher');
        options = options || {};
        const key = `${directory} ${JSON.stringify(options)}`;
        if (!this.directoryWatchers[key]) {
            this.directoryWatchers[key] = new DirectoryWatcher(directory, options);
            this.directoryWatchers[key].on('closed', () => {
                delete this.directoryWatchers[key];
            });
        }
        return this.directoryWatchers[key];
    }

    watchFile(p: string, options: Watchpack.WatcherOptions, startTime: number) {
        const directory = path.dirname(p);
        return this.getDirectoryWatcher(directory, options).watch(p, startTime);
    }

    watchDirectory(directory: string, options: Watchpack.WatcherOptions, startTime: number) {
        return this.getDirectoryWatcher(directory, options).watch(directory, startTime);
    }
}

export = new WatcherManager();
