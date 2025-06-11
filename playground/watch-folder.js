"use strict";

const path = require("path");
const Watchpack = require("../");

const folder = path.join(__dirname, "folder");

function startWatcher(name, files, folders) {
	const w = new Watchpack({
		aggregateTimeout: 3000,
	});

	w.on("change", (file, mtime) => {
		// eslint-disable-next-line no-console
		console.log(name, "change", path.relative(folder, file), mtime);
	});

	w.on("aggregated", (changes) => {
		const times = w.getTimes();
		// eslint-disable-next-line no-console
		console.log(
			name,
			"aggregated",
			Array.from(changes, (file) => path.relative(folder, file)),
			Object.keys(times).reduce((obj, file) => {
				obj[path.relative(folder, file)] = times[file];
				return obj;
			}, {}),
		);
	});

	const startTime = Date.now() - 10000;
	// eslint-disable-next-line no-console
	console.log(name, startTime);
	w.watch(files, folders, startTime);
}

startWatcher("folder", [], [folder]);
startWatcher(
	"sub+files",
	[
		path.join(folder, "a.txt"),
		path.join(folder, "b.txt"),
		path.join(folder, "c.txt"),
		path.join(folder, "d.txt"),
	],
	[path.join(folder, "subfolder")],
);
