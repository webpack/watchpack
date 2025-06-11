"use strict";

const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const writeFileAtomic = require("write-file-atomic");

const watchEventSource = require("../../lib/watchEventSource");

require("../../lib/getWatcherManager");
let watcherManagerModule =
	require.cache[require.resolve("../../lib/getWatcherManager")];

const allWatcherManager = new Set();
const oldFn = watcherManagerModule.exports;
watcherManagerModule = (options) => {
	const watcherManager = oldFn(options);
	allWatcherManager.add(watcherManager);
};

const checkAllWatcherClosed = () => {
	for (const watcherManager of allWatcherManager) {
		[...watcherManager.directoryWatchers.keys()].should.be.eql([]);
	}
	watchEventSource.getNumberOfWatchers().should.be.eql(0);
};

function TestHelper(testdir) {
	this.testdir = testdir;
	const self = this;
	this.before = function before(done) {
		self._before(done);
	};
	this.after = function after(done) {
		self._after(done);
	};
}

module.exports = TestHelper;

TestHelper.prototype._before = function _before(done) {
	checkAllWatcherClosed();
	this.tick(400, () => {
		rimraf.sync(this.testdir);
		fs.mkdirSync(this.testdir);
		done();
	});
};

TestHelper.prototype._after = function _after(done) {
	let i = 0;
	this.tick(
		300,
		function del() {
			try {
				rimraf.sync(this.testdir);
			} catch (err) {
				if (i++ > 20) throw err;
				this.tick(100, del.bind(this));
				return;
			}
			checkAllWatcherClosed();
			this.tick(300, done);
		}.bind(this),
	);
};

TestHelper.prototype.dir = function dir(name) {
	fs.mkdirSync(path.join(this.testdir, name));
};

TestHelper.prototype.rename = function rename(orig, dest) {
	fs.renameSync(path.join(this.testdir, orig), path.join(this.testdir, dest));
};

TestHelper.prototype.file = function file(name) {
	fs.writeFileSync(path.join(this.testdir, name), `${Math.random()}`, "utf8");
};

TestHelper.prototype.fileAtomic = function fileAtomic(name) {
	writeFileAtomic.sync(
		path.join(this.testdir, name),
		`${Math.random()}`,
		"utf8",
	);
};

TestHelper.prototype.accessFile = function accessFile(name) {
	const stat = fs.statSync(path.join(this.testdir, name));
	fs.utimesSync(
		path.join(this.testdir, name),
		new Date(Date.now() - 1000 * 60 * 60 * 24),
		stat.mtime,
	);
	fs.readFileSync(path.join(this.testdir, name));
};

TestHelper.prototype.symlinkFile = function symlinkFile(name, target) {
	fs.symlinkSync(target, path.join(this.testdir, name), "file");
};

TestHelper.prototype.symlinkDir = function symlinkDir(name, target) {
	fs.symlinkSync(target, path.join(this.testdir, name), "dir");
};

TestHelper.prototype.unlink = function unlink(name) {
	fs.unlinkSync(path.join(this.testdir, name));
};

TestHelper.prototype.mtime = function mtime(name, mtime) {
	const stats = fs.statSync(path.join(this.testdir, name));
	fs.utimesSync(path.join(this.testdir, name), stats.atime, new Date(mtime));
};

TestHelper.prototype.remove = function remove(name) {
	rimraf.sync(path.join(this.testdir, name));
};

TestHelper.prototype.tick = function tick(arg, fn) {
	// if polling is set, ensure the tick is longer than the polling interval.
	const defaultTick = (Number(process.env.WATCHPACK_POLLING) || 100) + 10;
	if (typeof arg === "function") {
		fn = arg;
		arg = defaultTick;
	}
	setTimeout(() => {
		fn();
	}, arg);
};

TestHelper.prototype.getNumberOfWatchers = function getNumberOfWatchers() {
	let count = 0;
	for (const watcherManager of allWatcherManager) {
		count += watcherManager.directoryWatchers.size;
	}
	return count;
};
