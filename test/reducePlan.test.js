"use strict";

const path = require("path");
const reducePlan = require("../lib/reducePlan");

const { sep } = path;
const root = path.resolve(sep);

describe("reducePlan", () => {
	it("should return an empty plan when input is empty", () => {
		const result = reducePlan(new Map(), 10);
		expect(result.size).toBe(0);
	});

	it("should not reduce when count is at or below limit", () => {
		const plan = new Map([
			[path.join(root, "a", "b"), "v1"],
			[path.join(root, "a", "c"), "v2"],
		]);
		const result = reducePlan(plan, 10);
		// Both entries remain as separate groups
		expect(result.size).toBe(2);
		const first =
			/** @type {Map<string, string>} */
			(result.get(path.join(root, "a", "b")));
		expect(first).toBeInstanceOf(Map);
		expect(first.get("v1")).toBe(path.join(root, "a", "b"));
	});

	it("should merge child entries under a common parent when over the limit", () => {
		const plan = new Map();
		for (let i = 0; i < 20; i++) {
			plan.set(path.join(root, "parent", `child${i}`), `v${i}`);
		}
		const result = reducePlan(plan, 1);
		// A single merged plan with the parent as root
		expect(result.size).toBe(1);
		const [[rootTarget, entryMap]] = [...result];
		expect(rootTarget).toBe(path.join(root, "parent"));
		expect(entryMap.size).toBe(20);
		for (let i = 0; i < 20; i++) {
			expect(entryMap.get(`v${i}`)).toBe(
				path.join(root, "parent", `child${i}`),
			);
		}
	});

	it("should support array values at a node", () => {
		const plan = new Map();
		plan.set(path.join(root, "p", "a"), ["v1", "v2"]);
		plan.set(path.join(root, "p", "b"), "v3");
		plan.set(path.join(root, "p", "c"), "v4");
		const result = reducePlan(plan, 1);
		expect(result.size).toBe(1);
		const [entryMap] = [...result.values()];
		expect(entryMap.size).toBe(4);
	});

	it("should merge partially when limit allows keeping some entries separate", () => {
		const plan = new Map();
		// Two separate subtrees
		plan.set(path.join(root, "sub1", "a"), "a1");
		plan.set(path.join(root, "sub1", "b"), "a2");
		plan.set(path.join(root, "sub2", "a"), "b1");
		plan.set(path.join(root, "sub2", "b"), "b2");
		const result = reducePlan(plan, 2);
		// Should merge each subtree into one
		expect(result.size).toBeGreaterThanOrEqual(1);
		let total = 0;
		for (const entryMap of result.values()) {
			total += entryMap.size;
		}
		expect(total).toBe(4);
	});

	it("should skip a single-child node with no value when selecting merges", () => {
		const plan = new Map();
		// /r/a/c, /r/a/d -> /r/a has 2 children
		// /r/b -> 1 child
		plan.set(path.join(root, "r", "a", "c"), "c");
		plan.set(path.join(root, "r", "a", "d"), "d");
		plan.set(path.join(root, "r", "b"), "b");
		const result = reducePlan(plan, 2);
		let total = 0;
		for (const entryMap of result.values()) {
			total += entryMap.size;
		}
		expect(total).toBe(3);
	});

	it("should reduce with deep nesting", () => {
		const plan = new Map();
		for (let i = 0; i < 6; i++) {
			plan.set(path.join(root, "x", "y", "z", `f${i}`), `v${i}`);
		}
		const result = reducePlan(plan, 1);
		const [entryMap] = [...result.values()];
		expect(entryMap.size).toBe(6);
	});
});
