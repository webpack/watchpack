# watchpack

Wrapper library for directory and file watching.

## Concept

watchpack high level API don't map directly to watchers. Instead a three level architecture ensures that for each directory only a single watcher exists.

* The high level API requests `DirectoryWatchers` from a `WatcherManager`, which ensures that only a single `DirectoryWatcher` per directory is created.
* A `FileWatcher` can be obtained from a `DirectoryWatcher` and provides a filtered view on the `DirectoryWatcher`.
* Reference-counting is used on the `DirectoryWatcher` and `FileWatcher` to decide when to close them.
* The real watchers (currently chokidar) are created by the `DirectoryWatcher`.
* Files are never watched directly. This should keep the watcher count low.

## API

``` javascript
var Watchpack = require("watchpack");

var wp = new Watchpack({
	// options:
	aggregateTimeout: 1000
	// fire "aggregated" event when after a change for 1000ms no additonal change occured
});

// Watchpack.prototype.watch(string[] files, string[] directories, [number startTime])
wp.watch(listOfFiles, listOfDirectories, Date.now() - 10000);
// starts watching these files and directories
// calling this again will override the files and directories

wp.on("change", function(filePath, mtime) {
	// filePath: the changed file
	// mtime: last modified time for the changed file
});

wp.on("aggregated", function(changes) {
	// changes: an array of all changed files
});

// Watchpack.prototype.pause()
wp.pause();
// stops emitting events, but keeps watchers open

// Watchpack.prototype.close()
wp.close();
// stops emitting events and closes all watchers

// Watchpack.prototype.getTimes()
var fileTimes = wp.getTimes();
// returns an object with all know change times for files
// this include timestamps from files not directly watched
// key: absolute path, value: timestamp as number
```

