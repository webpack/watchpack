/*
 * watchpack-construction
 *
 * Webpack creates and tears down a Watchpack instance at module boundaries
 * and on every dev-server restart. The constructor compiles the `ignored`
 * matcher, installs it on a WeakMap-keyed options cache, and wires up the
 * internal `WatcherManager`. This case measures the construction cost for
 * each supported `ignored` option shape so any regression in that setup
 * path surfaces before it reaches webpack users.
 *
 * `.close()` is invoked after every construction to keep the outer test
 * process from leaking timers even though no watchers have been attached.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Watchpack = require("../../../lib/index.js");

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

/**
 * @param {import('tinybench').Bench} bench
 */
export default function register(bench) {
	bench.add("watchpack-construction: no ignored option", () => {
		new Watchpack(optionsNone).close();
	});
	bench.add("watchpack-construction: regex ignored", () => {
		new Watchpack(optionsWithRegExp).close();
	});
	bench.add("watchpack-construction: glob string ignored", () => {
		new Watchpack(optionsWithString).close();
	});
	bench.add("watchpack-construction: array[2] ignored", () => {
		new Watchpack(optionsWithSmallArray).close();
	});
	bench.add("watchpack-construction: array[10] ignored", () => {
		new Watchpack(optionsWithLargeArray).close();
	});
	bench.add("watchpack-construction: function ignored", () => {
		new Watchpack(optionsWithFn).close();
	});
	bench.add("watchpack-construction: cached options (WeakMap hit)", () => {
		// Same options object every iteration exercises the WeakMap cache
		// installed on the options by `cachedNormalizeOptions`.
		new Watchpack(optionsWithLargeArray).close();
	});
}
