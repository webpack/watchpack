"use strict";

const fs = require("fs");
const path = require("path");
const Watchpack = require("../lib");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(20000);

describe("Watcher limit of the system (#46)", () => {
	beforeEach((done) => {
		testHelper.before(done);
	});

	/** @type {InstanceType<typeof Watchpack>[]} */
	let watchers = [];

	afterEach((done) => {
		// closed here, not in the test, so a failure cannot leave one running
		for (const w of watchers) w.close();
		watchers = [];
		jest.restoreAllMocks();
		testHelper.after(done);
	});

	it("should poll a directory it cannot watch instead of reporting its files as removed", (done) => {
		const dir = path.join(fixtures, "dir");
		const file = path.join(dir, "a");
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		const { watch } = fs;
		let watchCalls = 0;
		jest.spyOn(fs, "watch").mockImplementation((target, ...args) => {
			if (target === dir) {
				watchCalls++;
				throw Object.assign(
					new Error(
						`ENOSPC: System limit for number of file watchers reached, watch '${dir}'`,
					),
					{ code: "ENOSPC" },
				);
			}
			return /** @type {(...a: unknown[]) => fs.FSWatcher} */ (watch)(
				target,
				...args,
			);
		});
		const errors = jest.spyOn(console, "error").mockImplementation(() => {});
		testHelper.tick(1000, () => {
			const w = new Watchpack({ aggregateTimeout: 100 });
			watchers.push(w);
			/** @type {string[]} */
			const removed = [];
			w.on("remove", (item) => {
				removed.push(item);
			});
			w.on("change", (item) => {
				expect(item).toBe(file);
				expect(removed).toEqual([]);
				// tried once, not again and again
				expect(watchCalls).toBeLessThanOrEqual(1);
				expect(
					errors.mock.calls.filter((call) => /ENOSPC/.test(String(call[0]))),
				).toHaveLength(watchCalls);
				done();
			});
			w.watch({ files: [file], startTime: Date.now() });
			testHelper.tick(1000, () => {
				testHelper.file(path.join("dir", "a"));
			});
		});
	});
});
