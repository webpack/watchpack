declare namespace _exports {
	export {
		NormalizedWatchOptions,
		EventMap,
		DirectoryWatcherEvents,
		FileWatcherEvents,
		Watcher,
	};
}
declare function _exports(options: NormalizedWatchOptions): WatcherManager;
declare namespace _exports {
	export { WatcherManager };
}
export = _exports;
type NormalizedWatchOptions = import("./index").NormalizedWatchOptions;
type EventMap = import("./index").EventMap;
type DirectoryWatcherEvents =
	import("./DirectoryWatcher").DirectoryWatcherEvents;
type FileWatcherEvents = import("./DirectoryWatcher").FileWatcherEvents;
type Watcher<T extends EventMap> = import("./DirectoryWatcher").Watcher<T>;
/** @typedef {import("./index").NormalizedWatchOptions} NormalizedWatchOptions */
/** @typedef {import("./index").EventMap} EventMap */
/** @typedef {import("./DirectoryWatcher").DirectoryWatcherEvents} DirectoryWatcherEvents */
/** @typedef {import("./DirectoryWatcher").FileWatcherEvents} FileWatcherEvents */
/**
 * @template {EventMap} T
 * @typedef {import("./DirectoryWatcher").Watcher<T>} Watcher
 */
declare class WatcherManager {
	/**
	 * @param {NormalizedWatchOptions} options options
	 */
	constructor(options: NormalizedWatchOptions);
	options: import("./index").NormalizedWatchOptions;
	/** @type {Map<string, DirectoryWatcher>} */
	directoryWatchers: Map<string, DirectoryWatcher>;
	/**
	 * @param {string} directory a directory
	 * @returns {DirectoryWatcher} a directory watcher
	 */
	getDirectoryWatcher(directory: string): DirectoryWatcher;
	/**
	 * @param {string} file file
	 * @param {number=} startTime start time
	 * @returns {Watcher<FileWatcherEvents> | null} watcher or null if file has no directory
	 */
	watchFile(
		file: string,
		startTime?: number | undefined,
	): Watcher<FileWatcherEvents> | null;
	/**
	 * @param {string} directory directory
	 * @param {number=} startTime start time
	 * @returns {Watcher<DirectoryWatcherEvents>} watcher
	 */
	watchDirectory(
		directory: string,
		startTime?: number | undefined,
	): Watcher<DirectoryWatcherEvents>;
}
import DirectoryWatcher = require("./DirectoryWatcher");
