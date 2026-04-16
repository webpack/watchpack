/*
	MIT License http://www.opensource.org/licenses/mit-license.php

	Shared plumbing for the tinybench suites shipped under bench/. Each suite
	file declares its cases and exports the resulting Bench; everything else
	(CodSpeed wiring, require resolution, standalone entrypoint behaviour,
	aggregate runner) lives here so the per-suite files look as close as
	possible to "just the benchmark cases".
*/

import { Bench } from "tinybench";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { createRequire } from "module";
import { pathToFileURL } from "url";

// Keep the measurement window in one place so every suite reports on the
// same time budget and CodSpeed sees comparable sample counts between runs.
const BENCH_TIME_MS = 200;

/**
 * Create a CodSpeed-wrapped Bench with our standard options.
 * @param {string} name suite name (shown in CodSpeed and in the aggregate
 * runner's section headers)
 * @returns {Bench} bench
 */
export const createBench = (name) =>
	withCodSpeed(new Bench({ name, time: BENCH_TIME_MS }));

/**
 * Anchor a CommonJS `require` to the given ESM module. Lets bench files
 * pull in watchpack's CJS lib modules with the same relative paths they
 * would use in a .js sibling.
 * @param {string} importMetaUrl caller's import.meta.url
 * @returns {NodeRequire} require
 */
export const moduleRequire = (importMetaUrl) => createRequire(importMetaUrl);

/**
 * Run the suite and print its table when the bench file is invoked
 * directly (e.g. `npm run bench:<name>`). No-op when the file is only
 * imported by the aggregate runner.
 * @param {string} importMetaUrl caller's import.meta.url
 * @param {Bench} bench bench to run
 */
export const runIfMain = async (importMetaUrl, bench) => {
	if (!process.argv[1]) return;
	if (importMetaUrl !== pathToFileURL(process.argv[1]).href) return;
	await bench.run();
	console.table(bench.table());
};

/**
 * Run every supplied suite sequentially and print a labeled table per suite.
 * Used by bench/index.mjs to produce a single aggregate report.
 * @param {Bench[]} suites suites
 */
export const runSuites = async (suites) => {
	for (const suite of suites) {
		process.stdout.write(`\n== ${suite.name ?? "bench"} ==\n`);
		// eslint-disable-next-line no-await-in-loop
		await suite.run();
		console.table(suite.table());
	}
};
