/*
	MIT License http://www.opensource.org/licenses/mit-license.php
*/

import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Require the internal helpers via the package entry to avoid duplication.
// We re-implement the call paths through the public Watchpack constructor
// which normalizes ignored exactly once per options object.
const Watchpack = require("../../lib/index.js");

/**
 * Build a normalized ignored function using Watchpack's public API so that
 * we benchmark the same code path users exercise in practice.
 * @param {import("../../lib/index").WatchOptions} options
 * @returns {(item: string) => boolean}
 */
const buildIgnored = (options) => {
	const wp = new Watchpack(options);
	return wp.watcherOptions.ignored;
};

const UNIX_PATHS = [
	"/home/user/project/src/index.js",
	"/home/user/project/src/components/App.jsx",
	"/home/user/project/node_modules/react/index.js",
	"/home/user/project/dist/bundle.js",
	"/home/user/project/.git/HEAD",
	"/home/user/project/coverage/lcov.info",
	"/home/user/project/src/utils/helpers.ts",
	"/home/user/project/test/fixtures/a.js",
	"/home/user/project/README.md",
	"/home/user/project/package.json",
];

const WINDOWS_PATHS = UNIX_PATHS.map((p) => p.replace(/\//g, "\\"));

const bench = withCodSpeed(new Bench({ name: "ignored", time: 200 }));

const noneMatcher = buildIgnored({});
const regexpMatcher = buildIgnored({
	ignored: /node_modules|\.git|dist|coverage/,
});
const stringMatcher = buildIgnored({ ignored: "**/node_modules" });
const smallArrayMatcher = buildIgnored({
	ignored: ["**/node_modules", "**/.git"],
});
const largeArrayMatcher = buildIgnored({
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
});
const functionMatcher = buildIgnored({
	ignored: (p) => p.includes("node_modules") || p.includes(".git"),
});

bench
	.add("ignored=undefined (noop) unix paths", () => {
		for (const p of UNIX_PATHS) noneMatcher(p);
	})
	.add("ignored=regexp unix paths", () => {
		for (const p of UNIX_PATHS) regexpMatcher(p);
	})
	.add("ignored=regexp windows paths", () => {
		for (const p of WINDOWS_PATHS) regexpMatcher(p);
	})
	.add("ignored=string unix paths", () => {
		for (const p of UNIX_PATHS) stringMatcher(p);
	})
	.add("ignored=array[2] unix paths", () => {
		for (const p of UNIX_PATHS) smallArrayMatcher(p);
	})
	.add("ignored=array[10] unix paths", () => {
		for (const p of UNIX_PATHS) largeArrayMatcher(p);
	})
	.add("ignored=array[10] windows paths", () => {
		for (const p of WINDOWS_PATHS) largeArrayMatcher(p);
	})
	.add("ignored=function unix paths", () => {
		for (const p of UNIX_PATHS) functionMatcher(p);
	});

export default bench;

if (import.meta.url === `file://${process.argv[1]}`) {
	await bench.run();
	console.table(bench.table());
}
