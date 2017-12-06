'use strict';

const EventEmitter = require('events').EventEmitter;

module.exports = class Watcher extends EventEmitter {
  constructor(directoryWatcher, filePath, startTime) {
    super();

    this.directoryWatcher = directoryWatcher;
    this.path = filePath;
    this.startTime = startTime && +startTime;
    this.data = 0;
  }

  checkStartTime(mtime, initial) {
    if (typeof this.startTime !== 'number') return !initial;
    const startTime = this.startTime;
    return startTime <= mtime;
  }

  close() {
    this.emit('closed');
  }
};
