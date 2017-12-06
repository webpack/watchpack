'use strict';

/**
 * MIT License http://www.opensource.org/licenses/mit-license.php
 * Author Tobias Koppers @sokra
 */
const path = require('path');
const DirectoryWatcher = require('./DirectoryWatcher');

module.exports = class WatcherManager {
  constructor() {
    this.cache = {};
  }

  getDirectoryWatcher(directory, options) {
    options = options || {};
    const key = `${directory} ${JSON.stringify(options)}`;
    if (!this.cache[key]) {
      this.cache[key] = new DirectoryWatcher(directory, options);
      this.cache[key].on('closed', () => {
        delete this.cache[key];
      });
    }
    return this.cache[key];
  }

  watchDirectory(directory, options, startTime) {
    const watcher = this.getDirectoryWatcher(directory, options);

    return watcher.watch(directory, startTime);
  }

  watchFile(filePath, options, startTime) {
    const directory = path.dirname(filePath);
    const watcher = this.getDirectoryWatcher(directory, options);

    return watcher.watch(filePath, startTime);
  }
};
