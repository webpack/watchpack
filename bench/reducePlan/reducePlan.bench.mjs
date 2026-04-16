/*
	MIT License http://www.opensource.org/licenses/mit-license.php
*/

import { createBench, moduleRequire, runIfMain } from "../helpers.mjs";

const require = moduleRequire(import.meta.url);
const reducePlan = require("../../lib/reducePlan.js");

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
			const p = `${prefix}${SEP}file${i}`;
			plan.set(p, `v${i++}`);
		}
		if (level < depth) {
			walk(`${prefix}${SEP}sub${level}`, level + 1);
		}
	};
	walk(ROOT, 0);
	return plan;
};

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

const smallPlan = buildWidePlan(50, 10);
const mediumPlan = buildWidePlan(500, 20);
const largePlan = buildWidePlan(2000, 25);
const hugePlan = buildWidePlan(10000, 40);
const deepPlan = buildDeepPlan(30, 3);
const veryDeepPlan = buildDeepPlan(80, 2);
const flatPlan = buildFlatPlan(500);
const flatLargePlan = buildFlatPlan(5000);

const bench = createBench("reducePlan");

bench
	.add("under limit (no-op, n=50, limit=100)", () => {
		reducePlan(smallPlan, 100);
	})
	.add("small plan reduction (n=50, limit=10)", () => {
		reducePlan(smallPlan, 10);
	})
	.add("medium plan reduction (n=500, limit=50)", () => {
		reducePlan(mediumPlan, 50);
	})
	.add("medium plan light reduction (n=500, limit=400)", () => {
		reducePlan(mediumPlan, 400);
	})
	.add("medium plan barely over (n=500, limit=499)", () => {
		reducePlan(mediumPlan, 499);
	})
	.add("large plan reduction (n=2000, limit=100)", () => {
		reducePlan(largePlan, 100);
	})
	.add("large plan aggressive (n=2000, limit=10)", () => {
		reducePlan(largePlan, 10);
	})
	.add("huge plan reduction (n=10000, limit=500)", () => {
		reducePlan(hugePlan, 500);
	})
	.add("deep plan reduction (depth=30, limit=20)", () => {
		reducePlan(deepPlan, 20);
	})
	.add("very deep plan (depth=80, limit=40)", () => {
		reducePlan(veryDeepPlan, 40);
	})
	.add("flat plan reduction (n=500 in one dir, limit=50)", () => {
		reducePlan(flatPlan, 50);
	})
	.add("flat large plan (n=5000 in one dir, limit=100)", () => {
		reducePlan(flatLargePlan, 100);
	});

export default bench;

await runIfMain(import.meta.url, bench);
