"use strict";

/* global expect */

const fs = require("fs");
const path = require("path");
// @ts-expect-error no need extra types
const rimraf = require("rimraf");
// @ts-expect-error no need extra types
const writeFileAtomic = require("write-file-atomic");

/** @typedef {import("../../lib/getWatcherManager").DirectoryWatcherOptions} DirectoryWatcherOptions */
/** @typedef {import("../../lib/getWatcherManager").WatcherManager} WatcherManager */

const watchEventSource = require("../../lib/watchEventSource");

require("../../lib/getWatcherManager");
let watcherManagerModule =
	require.cache[require.resolve("../../lib/getWatcherManager")];

/** @type {Set<WatcherManager>} */
const allWatcherManager = new Set();
// @ts-expect-error for tests
const oldFn = watcherManagerModule.exports;

// @ts-expect-error for tests
watcherManagerModule = (options) => {
	const watcherManager = oldFn(options);
	allWatcherManager.add(watcherManager);
};

const checkAllWatcherClosed = () => {
	for (const watcherManager of allWatcherManager) {
		expect([...watcherManager.directoryWatchers.keys()]).toEqual([]);
	}
	expect(watchEventSource.getNumberOfWatchers()).toBe(0);
};

class TestHelper {
	/**
	 * @param {string} testdir testdir
	 */
	constructor(testdir) {
		this.testdir = testdir;
	}

	/**
	 * @param {number | (() => void)} arg arg
	 * @param {() => void=} fn fn
	 */
	tick(arg, fn) {
		// if polling is set, ensure the tick is longer than the polling interval.
		const defaultTick = (Number(process.env.WATCHPACK_POLLING) || 100) + 10;

		if (typeof arg === "function") {
			fn = arg;
			arg = defaultTick;
		}

		setTimeout(() => {
			/** @type {() => void} */
			(fn)();
		}, arg);
	}

	/**
	 * @param {() => void} done done
	 */
	before(done) {
		checkAllWatcherClosed();
		this.tick(400, () => {
			rimraf.sync(this.testdir);
			fs.mkdirSync(this.testdir);
			done();
		});
	}

	/**
	 * @param {() => void} done done
	 */
	after(done) {
		let i = 0;

		const del = () => {
			try {
				rimraf.sync(this.testdir);
			} catch (err) {
				if (i++ > 20) throw err;
				this.tick(100, del.bind(this));
				return;
			}
			checkAllWatcherClosed();
			this.tick(300, done);
		};

		this.tick(300, () => {
			del();
		});
	}

	/**
	 * @param {string} name name
	 */
	dir(name) {
		fs.mkdirSync(path.join(this.testdir, name));
	}

	/**
	 * @param {string} orig orig
	 * @param {string} dest dest
	 */
	rename(orig, dest) {
		fs.renameSync(path.join(this.testdir, orig), path.join(this.testdir, dest));
	}

	/**
	 * @param {string} name name
	 */
	file(name) {
		fs.writeFileSync(path.join(this.testdir, name), `${Math.random()}`, "utf8");
	}

	/**
	 * @param {string} name name
	 */
	fileAtomic(name) {
		writeFileAtomic.sync(
			path.join(this.testdir, name),
			`${Math.random()}`,
			"utf8",
		);
	}

	/**
	 * @param {string} name name
	 */
	accessFile(name) {
		const stat = fs.statSync(path.join(this.testdir, name));
		fs.utimesSync(
			path.join(this.testdir, name),
			new Date(Date.now() - 1000 * 60 * 60 * 24),
			stat.mtime,
		);
		fs.readFileSync(path.join(this.testdir, name));
	}

	/**
	 * @param {string} name name
	 * @param {string} target target
	 */
	symlinkFile(name, target) {
		fs.symlinkSync(target, path.join(this.testdir, name), "file");
	}

	/**
	 * @param {string} name name
	 * @param {string} target target
	 */
	symlinkDir(name, target) {
		fs.symlinkSync(target, path.join(this.testdir, name), "dir");
	}

	/**
	 * @param {string} name name
	 */
	unlink(name) {
		fs.unlinkSync(path.join(this.testdir, name));
	}

	/**
	 * @param {string} name name
	 * @param {number} mtime mtime
	 */
	mtime(name, mtime) {
		const stats = fs.statSync(path.join(this.testdir, name));
		fs.utimesSync(path.join(this.testdir, name), stats.atime, new Date(mtime));
	}

	/**
	 * @param {string} name name
	 */
	remove(name) {
		rimraf.sync(path.join(this.testdir, name));
	}

	getNumberOfWatchers() {
		let count = 0;
		for (const watcherManager of allWatcherManager) {
			count += watcherManager.directoryWatchers.size;
		}
		return count;
	}
}

module.exports = TestHelper;
