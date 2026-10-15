"use strict";

/* eslint-disable no-console, n/no-unsupported-features/node-builtins */

// Temporary probe: does starting another directory watcher on macOS drop an
// event that happened just before? libuv shares one FSEventStream between all
// directory watchers and recreates it "since now" whenever one is added or
// removed, so events not yet delivered may be lost.
const fs = require("fs");
const os = require("os");
const path = require("path");
const Watchpack = require("../lib/index");

const ITERATIONS = Number(process.env.ITERATIONS || 50);
const GAPS = [-1, 0, 5, 20, 50, 100];
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "probe-"));
const wait = (ms) =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

const setup = (id) => {
	const dir = path.join(root, `a-${id}`);
	const other = path.join(root, `b-${id}`);
	fs.mkdirSync(dir);
	fs.mkdirSync(other);
	const file = path.join(dir, "file.js");
	fs.writeFileSync(file, "1");
	return { dir, other, file };
};

// plain fs.watch
const rawRun = async (id, gap) => {
	const { dir, other, file } = setup(id);
	let seen = false;
	const watcher = fs.watch(dir, (type, filename) => {
		if (filename === "file.js" && !fs.existsSync(file)) seen = true;
	});
	await wait(300);
	fs.unlinkSync(file);
	let otherWatcher;
	if (gap >= 0) {
		await wait(gap);
		otherWatcher = fs.watch(other, () => {});
	}
	await wait(1000);
	watcher.close();
	if (otherWatcher) otherWatcher.close();
	return seen;
};

// watchpack, as webpack uses it
const watchpackRun = async (id, gap) => {
	const { other, file } = setup(id);
	let seen = false;
	const wp = new Watchpack({ aggregateTimeout: 10 });
	wp.on("remove", (item) => {
		if (item === file) seen = true;
	});
	wp.watch({ files: [file], startTime: Date.now() - 10000 });
	await wait(300);
	fs.unlinkSync(file);
	let otherWp;
	if (gap >= 0) {
		await wait(gap);
		otherWp = new Watchpack({});
		otherWp.watch({ directories: [other] });
	}
	await wait(1000);
	wp.close();
	if (otherWp) otherWp.close();
	return seen;
};

(async () => {
	for (const [name, run] of [
		["fs.watch", rawRun],
		["watchpack", watchpackRun],
	]) {
		const results = {};
		for (const gap of GAPS) {
			let lost = 0;
			for (let i = 0; i < ITERATIONS; i++) {
				if (!(await run(`${name}-${gap}-${i}`, gap))) lost++;
			}
			results[gap < 0 ? "no second watcher" : `second watcher after ${gap}ms`] =
				`${lost}/${ITERATIONS} deletions lost`;
		}
		console.log(name, process.platform, process.version, results);
	}
	fs.rmSync(root, { recursive: true, force: true });
})();
