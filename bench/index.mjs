/*
	MIT License http://www.opensource.org/licenses/mit-license.php

	Runs every tinybench suite shipped in this repository. Suites are split
	by the lib/ module they exercise so CodSpeed reports them as independent
	groups and so that running a single suite locally is cheap.
*/

import ignoredBench from "./ignored/ignored.bench.mjs";
import reducePlanBench from "./reducePlan/reducePlan.bench.mjs";
import linkResolverBench from "./LinkResolver/LinkResolver.bench.mjs";
import watchpackBench from "./watchpack/normalizeOptions.bench.mjs";

const suites = [
	ignoredBench,
	reducePlanBench,
	linkResolverBench,
	watchpackBench,
];

for (const suite of suites) {
	process.stdout.write(`\n== ${suite.name ?? "bench"} ==\n`);
	// eslint-disable-next-line no-await-in-loop
	await suite.run();
	console.table(suite.table());
}
