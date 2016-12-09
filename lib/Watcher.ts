import { EventEmitter } from 'events'
import DirectoryWatcher = require('./DirectoryWatcher')

class Watcher extends EventEmitter {
    data: number
    directoryWatcher: DirectoryWatcher
    path: string
    startTime: number

    constructor(directoryWatcher: DirectoryWatcher, filePath: string, startTime: number) {
        super();
        this.directoryWatcher = directoryWatcher;
        this.path = filePath;
        this.startTime = startTime && +startTime;
        this.data = 0;
    }

    checkStartTime(mtime: number, initial: boolean) {
        if (typeof this.startTime !== 'number') {
            return !initial;
        }
        const startTime = this.startTime;
        return startTime <= mtime;
    }

    close() {
        this.emit('closed');
    }
}

export = Watcher
