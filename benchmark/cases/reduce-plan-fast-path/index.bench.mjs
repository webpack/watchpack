/*
 * reduce-plan-fast-path
 *
 * Measures the cheap paths through reducePlan: plans that are already under
 * the limit (no reduction needed at all) and plans that are only slightly
 * over the limit (the while loop runs a handful of times). These should be
 * dominated by tree construction + the final "write down new plan" pass,
 * not by the selection loop.
 *
 * Keeping this isolated from the heavy cases means a regression in the
 * setup cost (e.g. accidentally quadratic tree building) shows up on its
 * own trend line instead of hiding under a 10ms huge-plan benchmark.
 */

import reducePlan from "../../../lib/reducePlan.js";

const ROOT = process.platform === "win32" ? "C:\\root" : "/root";
const SEP = process.platform === "win32" ? "\\" : "/";

/**
 * @param {number} count number of leaf targets
 * @param {number} width branching factor per directory
 * @returns {Map<string, string>} plan
 */
const buildWidePlan = (count, width) => {
	const plan = new Map();
	let i = 0;
	let dir = 0;
	while (i < count) {
		const group = `${ROOT}${SEP}group${dir}`;
		for (let j = 0; j < width && i < count; j++, i++) {
			plan.set(`${group}${SEP}file${i}`, `v${i}`);
		}
		dir++;
	}
	return plan;
};

const smallPlan = buildWidePlan(50, 10);
const mediumPlan = buildWidePlan(500, 20);

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	bench.add("reduce-plan-fast-path: under limit (n=50, limit=100)", () => {
		reducePlan(smallPlan, 100);
	});
	bench.add("reduce-plan-fast-path: barely over (n=500, limit=499)", () => {
		reducePlan(mediumPlan, 499);
	});
}
