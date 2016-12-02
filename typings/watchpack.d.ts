/// <reference types="node" />
import { EventEmitter } from 'events'
import Watcher = require('./Watcher');

declare class Watchpack extends EventEmitter {
    aggregatedChanges: string[];
    aggregateTimeout: NodeJS.Timer;
    dirWatchers: Watcher[];
    fileWatchers: Watcher[];
    mtimes: {
        [path: string]: number;
    };
    options: Watchpack.WatchOptions;
    paused: boolean;
    watcherOptions: Watchpack.WatcherOptions;

    constructor(options: Watchpack.WatchOptions);

    watch(files: string[], directories: string[], startTime: number): void;

    close(): void;

    pause(): void;

    getTimes(): {};

    _fileWatcher(file: string, watcher: Watcher): Watcher;

    _dirWatcher(item: string, watcher: Watcher): Watcher;

    _onChange(item: string, mtime: number, file?: string): void;

    _onTimeout(): void;
}

declare namespace Watchpack {
    interface WatcherOptions {
        ignored?: string[] | string | RegExp | ((path: string) => boolean);
        poll?: boolean | number;
    }
    interface WatchOptions extends WatcherOptions {
        aggregateTimeout?: number;
    }
}

export = Watchpack;
