/*
 * reduce-plan-deep
 *
 * Deeply nested path plans exercise the parent-chain walk in reducePlan's
 * tree-building pass (each leaf bubbles its entry count up an arbitrarily
 * long ancestor list) and the subtree-deactivation walk during reduction
 * (merging near the root has to mark every descendant inactive).
 *
 * `depth=30, leaves=3` approximates a monorepo with a handful of files at
 * every level; `depth=80, leaves=2` is a synthetic worst case with a long
 * spine and very few siblings per rung.
 */

import reducePlan from "../../../lib/reducePlan.js";

const ROOT = process.platform === "win32" ? "C:\\root" : "/root";
const SEP = process.platform === "win32" ? "\\" : "/";

/**
 * @param {number} depth directory depth
 * @param {number} leaves leaves per level
 * @returns {Map<string, string>} plan
 */
const buildDeepPlan = (depth, leaves) => {
	const plan = new Map();
	let i = 0;
	const walk = (prefix, level) => {
		for (let l = 0; l < leaves; l++) {
			plan.set(`${prefix}${SEP}file${i}`, `v${i++}`);
		}
		if (level < depth) walk(`${prefix}${SEP}sub${level}`, level + 1);
	};
	walk(ROOT, 0);
	return plan;
};

const deepPlan = buildDeepPlan(30, 3);
const veryDeepPlan = buildDeepPlan(80, 2);

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	bench.add("reduce-plan-deep: depth=30, leaves=3, limit=20", () => {
		reducePlan(deepPlan, 20);
	});
	bench.add("reduce-plan-deep: depth=80, leaves=2, limit=40", () => {
		reducePlan(veryDeepPlan, 40);
	});
}
