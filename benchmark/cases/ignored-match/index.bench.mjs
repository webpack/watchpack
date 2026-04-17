/*
 * ignored-match
 *
 * Exercises the `ignored` matcher against a realistic POSIX path batch for
 * every supported option shape (regex, glob string, short/long array, plain
 * predicate, and the "no ignored option" no-op fast path). The matcher is
 * what webpack hits per file for every watched entry, so the shape of this
 * batch dominates per-rebuild time in large projects.
 */

import Watchpack from "../../../lib/index.js";

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

/**
 * Reach into a Watchpack instance to get at the normalized matcher without
 * duplicating the option-compilation logic.
 * @param {import("../../../lib/index").WatchOptions} options options
 * @returns {(item: string) => boolean} true when ignored, otherwise false
 */
const buildIgnored = (options) => new Watchpack(options).watcherOptions.ignored;

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	const noneMatcher = buildIgnored({});
	const regexpMatcher = buildIgnored({
		ignored: /node_modules|\.git|dist|coverage/,
	});
	const stringMatcher = buildIgnored({ ignored: "**/node_modules" });
	const singletonArrayMatcher = buildIgnored({ ignored: ["**/node_modules"] });
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
		ignored: (path) => path.includes("node_modules") || path.includes(".git"),
	});

	bench.add("ignored-match: no ignored option (noop fast path)", () => {
		for (const path of UNIX_PATHS) noneMatcher(path);
	});
	bench.add("ignored-match: regex matcher", () => {
		for (const path of UNIX_PATHS) regexpMatcher(path);
	});
	bench.add("ignored-match: glob string matcher", () => {
		for (const path of UNIX_PATHS) stringMatcher(path);
	});
	bench.add("ignored-match: array[1] matcher", () => {
		for (const path of UNIX_PATHS) singletonArrayMatcher(path);
	});
	bench.add("ignored-match: array[2] matcher", () => {
		for (const path of UNIX_PATHS) smallArrayMatcher(path);
	});
	bench.add("ignored-match: array[10] matcher", () => {
		for (const path of UNIX_PATHS) largeArrayMatcher(path);
	});
	bench.add("ignored-match: function matcher", () => {
		for (const path of UNIX_PATHS) functionMatcher(path);
	});
}
