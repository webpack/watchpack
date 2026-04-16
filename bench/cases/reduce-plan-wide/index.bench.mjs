/*
 * reduce-plan-wide
 *
 * Exercises reducePlan on "wide" plans — lots of sibling leaves bucketed
 * under shared parent directories. This is the distribution webpack creates
 * when many watchers share a root but fan out into sub-trees, and it's the
 * stress pattern for the selection loop: every iteration of the outer
 * `while (currentCount > limit)` must scan the candidate set to find the
 * best node to merge.
 *
 * Three magnitudes: small (50), medium (500), large (2000), huge (10000).
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const reducePlan = require("../../../lib/reducePlan.js");

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
const largePlan = buildWidePlan(2000, 25);
const hugePlan = buildWidePlan(10000, 40);

/**
 * @param {import('tinybench').Bench} bench
 */
export default function register(bench) {
	bench.add("reduce-plan-wide: small plan (n=50, limit=10)", () => {
		reducePlan(smallPlan, 10);
	});
	bench.add("reduce-plan-wide: medium plan (n=500, limit=50)", () => {
		reducePlan(mediumPlan, 50);
	});
	bench.add("reduce-plan-wide: medium light (n=500, limit=400)", () => {
		reducePlan(mediumPlan, 400);
	});
	bench.add("reduce-plan-wide: large plan (n=2000, limit=100)", () => {
		reducePlan(largePlan, 100);
	});
	bench.add("reduce-plan-wide: large aggressive (n=2000, limit=10)", () => {
		reducePlan(largePlan, 10);
	});
	bench.add("reduce-plan-wide: huge plan (n=10000, limit=500)", () => {
		reducePlan(hugePlan, 500);
	});
}
