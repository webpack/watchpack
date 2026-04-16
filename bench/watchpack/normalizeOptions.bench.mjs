/*
	MIT License http://www.opensource.org/licenses/mit-license.php
*/

import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Watchpack = require("../../lib/index.js");

// The Watchpack constructor normalizes options and installs a cache on the
// options object. Measuring construction captures ignored compilation plus
// option validation, which is called frequently by webpack on each rebuild.

const optionsNone = {};
const optionsWithRegExp = { ignored: /node_modules|\.git/ };
const optionsWithString = { ignored: "**/node_modules" };
const optionsWithSmallArray = { ignored: ["**/node_modules", "**/.git"] };
const optionsWithLargeArray = {
	ignored: [
		"**/node_modules",
		"**/.git",
		"**/dist",
		"**/build",
		"**/coverage",
		"**/.cache",
		"**/.next",
		"**/.nuxt",
		"**/tmp",
		"**/*.log",
	],
};
const optionsWithFn = { ignored: (p) => p.includes("node_modules") };

const bench = withCodSpeed(
	new Bench({ name: "Watchpack construction", time: 200 }),
);

bench
	.add("new Watchpack() with no ignored", () => {
		const wp = new Watchpack(optionsNone);
		wp.close();
	})
	.add("new Watchpack() with regexp ignored", () => {
		const wp = new Watchpack(optionsWithRegExp);
		wp.close();
	})
	.add("new Watchpack() with string ignored", () => {
		const wp = new Watchpack(optionsWithString);
		wp.close();
	})
	.add("new Watchpack() with array[2] ignored", () => {
		const wp = new Watchpack(optionsWithSmallArray);
		wp.close();
	})
	.add("new Watchpack() with array[10] ignored", () => {
		const wp = new Watchpack(optionsWithLargeArray);
		wp.close();
	})
	.add("new Watchpack() with function ignored", () => {
		const wp = new Watchpack(optionsWithFn);
		wp.close();
	})
	.add("new Watchpack() reusing cached options", () => {
		// Exercises the WeakMap cache for option normalization.
		const wp = new Watchpack(optionsWithLargeArray);
		wp.close();
	});

export default bench;

if (import.meta.url === `file://${process.argv[1]}`) {
	await bench.run();
	console.table(bench.table());
}
