/*
	MIT License http://www.opensource.org/licenses/mit-license.php
*/

import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const LinkResolver = require("../../lib/LinkResolver.js");

// LinkResolver does real sync filesystem work via fs.readlinkSync.
// To keep benchmarks deterministic and instrumentation-friendly,
// we measure the path-walking + cache logic against paths that do not exist
// (readlinkSync throws ENOENT which is handled silently) and the cache fast
// path which is the most common case in real watch scenarios.

const SEP = process.platform === "win32" ? "\\" : "/";
const ROOT =
	process.platform === "win32" ? "C:\\nonexistent_bench" : "/nonexistent_bench";

/**
 * @param {number} depth path depth
 * @returns {string} path
 */
const makePath = (depth) => {
	let p = ROOT;
	for (let i = 0; i < depth; i++) p += `${SEP}level${i}`;
	return p;
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

const warmResolver = new LinkResolver();
for (const p of shallowPaths) warmResolver.resolve(p);
for (const p of mediumPaths) warmResolver.resolve(p);
for (const p of deepPaths) warmResolver.resolve(p);

const bench = withCodSpeed(new Bench({ name: "LinkResolver", time: 200 }));

bench
	.add("cold resolve shallow paths (depth=1, n=100)", () => {
		const resolver = new LinkResolver();
		for (const p of shallowPaths) resolver.resolve(p);
	})
	.add("cold resolve medium paths (depth=5, n=100)", () => {
		const resolver = new LinkResolver();
		for (const p of mediumPaths) resolver.resolve(p);
	})
	.add("cold resolve deep paths (depth=15, n=50)", () => {
		const resolver = new LinkResolver();
		for (const p of deepPaths) resolver.resolve(p);
	})
	.add("warm resolve shallow paths (cache hit, n=100)", () => {
		for (const p of shallowPaths) warmResolver.resolve(p);
	})
	.add("warm resolve deep paths (cache hit, n=50)", () => {
		for (const p of deepPaths) warmResolver.resolve(p);
	});

export default bench;

if (import.meta.url === `file://${process.argv[1]}`) {
	await bench.run();
	console.table(bench.table());
}
