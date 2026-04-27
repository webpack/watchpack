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
 *
 * Each benchmark body constructs BATCH instances in a loop. A single
 * construction is ~100 µs, so one instrumented iteration would be too short
 * for CodSpeed simulation mode to measure with low variance — batching
 * amortizes per-sample overhead (GC, JIT state, timer resolution) and
 * stabilizes CI-reported numbers.
 */

import Watchpack from "../../../lib/index.js";

const BATCH = 100;

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
const optionsWithFn = { ignored: (path) => path.includes("node_modules") };

/**
 * @param {object} options watchpack options reused across the batch
 */
const run = (options) => {
	for (let i = 0; i < BATCH; i++) {
		new Watchpack(options).close();
	}
};

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	bench.add("watchpack-construction: no ignored option", () => {
		run(optionsNone);
	});
	bench.add("watchpack-construction: regex ignored", () => {
		run(optionsWithRegExp);
	});
	bench.add("watchpack-construction: glob string ignored", () => {
		run(optionsWithString);
	});
	bench.add("watchpack-construction: array[2] ignored", () => {
		run(optionsWithSmallArray);
	});
	bench.add("watchpack-construction: array[10] ignored", () => {
		run(optionsWithLargeArray);
	});
	bench.add("watchpack-construction: function ignored", () => {
		run(optionsWithFn);
	});
	bench.add("watchpack-construction: cached options (WeakMap hit)", () => {
		// Same options object every iteration exercises the WeakMap cache
		// installed on the options by `cachedNormalizeOptions`.
		run(optionsWithLargeArray);
	});
}
