'use strict';

/**
* MIT License http://www.opensource.org/licenses/mit-license.php
* Author Tobias Koppers @sokra
*/
const { EventEmitter } = require('events');
const WatcherManager = require('./WatcherManager');

const manager = new WatcherManager();

function addWatchersToArray(watchers, array) {
  watchers.forEach((w) => {
    if (array.indexOf(w.directoryWatcher) < 0) {
      array.push(w.directoryWatcher);
      addWatchersToArray(Object.keys(w.directoryWatcher.directories).reduce((a, dir) => {
        if (w.directoryWatcher.directories[dir] !== true) { a.push(w.directoryWatcher.directories[dir]); }
        return a;
      }, []), array);
    }
  });
}

module.exports = class Watchpack extends EventEmitter {
  constructor(options) {
    super();

    if (!options) options = {};
    if (!options.aggregateTimeout) options.aggregateTimeout = 200;
    this.options = options;
    this.watcherOptions = {
      ignored: options.ignored,
      poll: options.poll
    };
    this.fileWatchers = [];
    this.dirWatchers = [];
    this.mtimes = Object.create(null);
    this.paused = false;
    this.aggregatedChanges = [];
    this.aggregatedRemovals = [];
    this.aggregateTimeout = 0;
    this._onTimeout = this._onTimeout.bind(this);
  }

  watch(files, directories, startTime) {
    this.paused = false;
    const oldFileWatchers = this.fileWatchers;
    const oldDirWatchers = this.dirWatchers;
    this.fileWatchers = files.map(function map(file) {
      return this._fileWatcher(file, manager.watchFile(file, this.watcherOptions, startTime));
    }, this);
    this.dirWatchers = directories.map(function map(dir) {
      return this._dirWatcher(dir, manager.watchDirectory(dir, this.watcherOptions, startTime));
    }, this);
    oldFileWatchers.forEach((w) => {
      w.close();
    }, this);
    oldDirWatchers.forEach((w) => {
      w.close();
    }, this);
  }

  resume() {
    this.paused = true;
    if (this.aggregateTimeout) { clearTimeout(this.aggregateTimeout); }
    this.fileWatchers.forEach((w) => {
      w.close();
    }, this);
    this.dirWatchers.forEach((w) => {
      w.close();
    }, this);
    this.fileWatchers.length = 0;
    this.dirWatchers.length = 0;
  }

  pause() {
    this.paused = true;
    if (this.aggregateTimeout) { clearTimeout(this.aggregateTimeout); }
  }

  getTimes() {
    const directoryWatchers = [];
    addWatchersToArray(this.fileWatchers.concat(this.dirWatchers), directoryWatchers);
    const obj = Object.create(null);
    directoryWatchers.forEach((w) => {
      const times = w.getTimes();
      Object.keys(times).forEach((file) => {
        obj[file] = times[file];
      });
    });
    return obj;
  }

  _fileWatcher(file, watcher) {
    watcher.on('change', (mtime, type) => {
      this._onChange(file, mtime, file, type);
    });
    watcher.on('remove', (type) => {
      this._onRemove(file, file, type);
    });
    return watcher;
  }

  _dirWatcher(item, watcher) {
    watcher.on('change', (file, mtime, type) => {
      this._onChange(item, mtime, file, type);
    });
    return watcher;
  }

  _onChange(item, mtime, file) {
    file = file || item;
    this.mtimes[file] = mtime;
    if (this.paused) return;
    this.emit('change', file, mtime);
    if (this.aggregateTimeout) { clearTimeout(this.aggregateTimeout); }
    if (this.aggregatedChanges.indexOf(item) < 0) { this.aggregatedChanges.push(item); }
    this.aggregateTimeout = setTimeout(this._onTimeout, this.options.aggregateTimeout);
  }

  _onRemove(item) {
    delete this.mtimes[item];
    if (this.paused) return;
    this.emit('remove', item);
    if (this.aggregateTimeout) { clearTimeout(this.aggregateTimeout); }
    if (this.aggregatedRemovals.indexOf(item) < 0) { this.aggregatedRemovals.push(item); }
    this.aggregateTimeout = setTimeout(this._onTimeout, this.options.aggregateTimeout);
  }

  _onTimeout() {
    this.aggregateTimeout = 0;
    const changes = this.aggregatedChanges;
    const removals = this.aggregatedRemovals;
    this.aggregatedChanges = [];
    this.aggregatedRemovals = [];
    this.emit('aggregated', changes, removals);
  }
};
