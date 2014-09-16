/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var path = require("path");
var DirectoryWatcher = require("./DirectoryWatcher");

function WatcherManager() {
	this.directoryWatchers = {};
}

WatcherManager.prototype.watchFile = function watchFile(p, startTime) {
	var directory = path.dirname(p);
	if(!this.directoryWatchers[directory]) {
		this.directoryWatchers[directory] = new DirectoryWatcher(directory, {});
		this.directoryWatchers[directory].on("closed", function() {
			delete this.directoryWatchers[directory];
		}.bind(this));
	}
	return this.directoryWatchers[directory].watch(p, startTime);
};

WatcherManager.prototype.watchDirectory = function watchDirectory(directory, startTime) {
	if(!this.directoryWatchers[directory]) {
		this.directoryWatchers[directory] = new DirectoryWatcher(directory, {});
		this.directoryWatchers[directory].on("closed", function() {
			delete this.directoryWatchers[directory];
		}.bind(this));
	}
	return this.directoryWatchers[directory].watch(directory, startTime);
};

module.exports = new WatcherManager();