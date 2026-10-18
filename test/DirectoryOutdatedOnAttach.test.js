"use strict";

const path = require("path");
const Watchpack = require("../lib");
const DirectoryWatcher = require("../lib/DirectoryWatcher");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(20000);

describe("Directory created before a watcher attaches", () => {
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

	/**
	 * @param {false | number} poll poll option
	 * @param {jest.DoneCallback} done done callback
	 */
	const expectReported = (poll, done) => {
		// how webpack hands over between builds: the paused watcher of the
		// last build sees the change, the next one attaches with the start
		// time of that build and the paused one is closed
		const dir = path.join(fixtures, "dir");
		// webpack passes the same options, so both share one directory watcher
		const options = { aggregateTimeout: 100, poll };
		testHelper.tick(1000, () => {
			const startTime = Date.now();
			const paused = new Watchpack(options);
			watchers.push(paused);
			paused.watch({ missing: [dir], startTime });
			testHelper.tick(500, () => {
				paused.pause();
				testHelper.dir("dir");
				const waitForPaused = () => {
					if (!paused.aggregatedChanges.has(dir)) {
						setTimeout(waitForPaused, 50);
						return;
					}
					const next = new Watchpack(options);
					watchers.push(next);
					next.on("aggregated", (changes) => {
						expect([...changes]).toEqual([dir]);
						done();
					});
					next.watch({ missing: [dir], startTime });
					paused.close();
				};
				waitForPaused();
			});
		});
	};

	it("should report a missing directory created after its start time", (done) => {
		expectReported(false, done);
	});

	it("should report a missing directory created after its start time (polling)", (done) => {
		expectReported(100, done);
	});

	it("should report a directory noticed after the start time though created before it", (done) => {
		// the next build starts right after the directory is created, before any
		// watcher notices it; the build read the cached state, so it did not see
		// the directory either
		const dir = path.join(fixtures, "dir");
		const options = { aggregateTimeout: 100, poll: 100 };
		testHelper.tick(1000, () => {
			const paused = new Watchpack(options);
			watchers.push(paused);
			paused.watch({ missing: [dir], startTime: Date.now() });
			testHelper.tick(500, () => {
				paused.pause();
				testHelper.dir("dir");
				const startTime = Date.now();
				const waitForPaused = () => {
					if (!paused.aggregatedChanges.has(dir)) {
						setTimeout(waitForPaused, 50);
						return;
					}
					const next = new Watchpack(options);
					watchers.push(next);
					next.on("aggregated", (changes) => {
						expect([...changes]).toEqual([dir]);
						done();
					});
					next.watch({ missing: [dir], startTime });
					paused.close();
				};
				waitForPaused();
			});
		});
	});

	it("should not keep retrying a removed directory its parent still lists", (done) => {
		// until its next scan the parent still lists the directory, which must
		// not count as the directory appearing again
		const dir = path.join(fixtures, "dir");
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		const { watchInParentDirectory } = DirectoryWatcher.prototype;
		let retries = 0;
		jest
			.spyOn(DirectoryWatcher.prototype, "watchInParentDirectory")
			.mockImplementation(
				/** @this {InstanceType<typeof DirectoryWatcher>} */
				function retry() {
					// a loop never yields to the timers, so it is cut off here
					if (++retries > 50) return;
					watchInParentDirectory.call(this);
				},
			);
		testHelper.tick(1000, () => {
			const w = new Watchpack({ aggregateTimeout: 100, poll: 1000 });
			watchers.push(w);
			w.watch({
				files: [path.join(dir, "a"), path.join(fixtures, "b")],
				startTime: Date.now(),
			});
			testHelper.tick(500, () => {
				testHelper.remove("dir");
				testHelper.tick(1500, () => {
					expect(retries).toBeLessThan(10);
					done();
				});
			});
		});
	});
});
