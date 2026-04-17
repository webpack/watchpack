/*
 * link-resolver
 *
 * LinkResolver resolves directory + file paths while expanding any symlinks
 * along the way. Webpack hits it on every watched entry before asking the
 * platform's fs.watch, so both the cold (first seen) and warm (cache hit)
 * paths matter: the former bounds worst-case rebuild latency, the latter
 * bounds the per-file cost of the steady state.
 *
 * To keep the benchmark deterministic we aim the resolver at a path that
 * does not exist. readlinkSync throws ENOENT, LinkResolver catches it
 * silently and walks its cache / parent chain exactly like it would for a
 * real path — without any filesystem side effects that would make CodSpeed
 * instrumentation noisy.
 */

import LinkResolver from "../../../lib/LinkResolver.js";

const SEP = process.platform === "win32" ? "\\" : "/";
const ROOT =
	process.platform === "win32" ? "C:\\nonexistent_bench" : "/nonexistent_bench";

const makePath = (depth) => {
	let path = ROOT;
	for (let i = 0; i < depth; i++) path += `${SEP}level${i}`;
	return path;
};

const shallowPaths = Array.from(
	{ length: 100 },
	(_, i) => `${ROOT}${SEP}file${i}`,
);
const mediumPaths = Array.from(
	{ length: 100 },
	(_, i) => `${makePath(5)}${SEP}file${i}`,
);
const deepPaths = Array.from(
	{ length: 50 },
	(_, i) => `${makePath(15)}${SEP}file${i}`,
);

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	// Pre-populated resolver for the warm/cache-hit measurements.
	const warmResolver = new LinkResolver();
	for (const path of shallowPaths) warmResolver.resolve(path);
	for (const path of mediumPaths) warmResolver.resolve(path);
	for (const path of deepPaths) warmResolver.resolve(path);

	bench.add("link-resolver: cold shallow batch (depth=1, n=100)", () => {
		const resolver = new LinkResolver();
		for (const path of shallowPaths) resolver.resolve(path);
	});
	bench.add("link-resolver: cold medium batch (depth=5, n=100)", () => {
		const resolver = new LinkResolver();
		for (const path of mediumPaths) resolver.resolve(path);
	});
	bench.add("link-resolver: cold deep batch (depth=15, n=50)", () => {
		const resolver = new LinkResolver();
		for (const path of deepPaths) resolver.resolve(path);
	});
	bench.add("link-resolver: warm shallow batch (cache hit, n=100)", () => {
		for (const path of shallowPaths) warmResolver.resolve(path);
	});
	bench.add("link-resolver: warm deep batch (cache hit, n=50)", () => {
		for (const path of deepPaths) warmResolver.resolve(path);
	});
}
