/*
 * reduce-plan-flat
 *
 * Lots of sibling entries under a single directory: every leaf shares the
 * same parent, so the tree is one level deep and the candidate-selection
 * loop only has a single viable merge target per round. This distribution
 * shows up in projects that watch many files in one folder (e.g. a single
 * "pages" or "generated" directory with hundreds of entries).
 */

import reducePlan from "../../../lib/reducePlan.js";

const ROOT = process.platform === "win32" ? "C:\\root" : "/root";
const SEP = process.platform === "win32" ? "\\" : "/";

/**
 * @param {number} count number of targets
 * @returns {Map<string, string>} plan
 */
const buildFlatPlan = (count) => {
	const plan = new Map();
	for (let i = 0; i < count; i++) {
		plan.set(`${ROOT}${SEP}file${i}`, `v${i}`);
	}
	return plan;
};

const flatMediumPlan = buildFlatPlan(500);
const flatLargePlan = buildFlatPlan(5000);

/**
 * @param {import("tinybench").Bench} bench bench
 */
export default function register(bench) {
	bench.add("reduce-plan-flat: n=500 in one dir, limit=50", () => {
		reducePlan(flatMediumPlan, 50);
	});
	bench.add("reduce-plan-flat: n=5000 in one dir, limit=100", () => {
		reducePlan(flatLargePlan, 100);
	});
}
