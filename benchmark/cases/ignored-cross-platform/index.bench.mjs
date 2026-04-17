/*
 * ignored-cross-platform
 *
 * Stress-tests the separator-normalization path in the `ignored` matcher.
 * The matcher must handle native Windows paths (with backslashes), paths
 * that have already been normalized to POSIX, and mixed bags produced by
 * cross-platform tools. This case isolates those scenarios from the plain
 * POSIX batch measured by `ignored-match` so the backslash-heavy code path
 * has its own CodSpeed trend line.
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

const WINDOWS_PATHS = UNIX_PATHS.map((path) => path.replace(/\//g, "\\"));
const MIXED_PATHS = UNIX_PATHS.map((path, i) =>
	i % 2 === 0 ? path : path.replace(/\//g, "\\"),
);

// Simulates a monorepo deep-path batch: each path has ~17 segments so the
// regex has to scan a long string before committing to match/no-match.
const DEEP_PATHS = Array.from({ length: 10 }, (_, i) => {
	const segments = Array.from({ length: 15 }, (_, j) => `level${j}`);
	segments.push(i === 3 ? "node_modules" : `leaf${i}`);
	segments.push("index.js");
	return `/${segments.join("/")}`;
});

/**
 * @param {import("../../../lib/index").WatchOptions} options options
 * @returns {(item: string) => boolean} true when ignored, otherwise false
 */
const buildIgnored = (options) => new Watchpack(options).watcherOptions.ignored;

const LARGE_ARRAY_IGNORED = [
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
];

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	const regexpMatcher = buildIgnored({
		ignored: /node_modules|\.git|dist|coverage/,
	});
	const arrayMatcher = buildIgnored({ ignored: LARGE_ARRAY_IGNORED });

	bench.add("ignored-cross-platform: regex against windows paths", () => {
		for (const path of WINDOWS_PATHS) regexpMatcher(path);
	});
	bench.add("ignored-cross-platform: regex against mixed separators", () => {
		for (const path of MIXED_PATHS) regexpMatcher(path);
	});
	bench.add("ignored-cross-platform: regex against deep posix paths", () => {
		for (const path of DEEP_PATHS) regexpMatcher(path);
	});
	bench.add("ignored-cross-platform: array[10] against windows paths", () => {
		for (const path of WINDOWS_PATHS) arrayMatcher(path);
	});
	bench.add(
		"ignored-cross-platform: array[10] against deep posix paths",
		() => {
			for (const path of DEEP_PATHS) arrayMatcher(path);
		},
	);
}
