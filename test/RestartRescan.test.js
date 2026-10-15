"use strict";

// macOS restarts its shared event stream whenever a directory watcher starts
// or stops and loses events it had not delivered yet. Enable the rescan that
// recovers them on every platform, and lose the event on purpose.
process.env.WATCHPACK_RESCAN_ON_RESTART = "1";
process.env.WATCHPACK_RESCAN_DELAY = "100";

const fs = require("fs");
const path = require("path");

const realWatch = fs.watch;
/** @type {string | undefined} */
let dropRemovalOf;
// @ts-expect-error for tests
fs.watch = (...args) => {
	// @ts-expect-error for tests
	const watcher = realWatch.apply(fs, args);
	const emit = watcher.emit.bind(watcher);
	watcher.emit = (event, type, filename, ...rest) => {
		if (
			event === "change" &&
			dropRemovalOf !== undefined &&
			filename &&
			path.basename(String(filename)) === dropRemovalOf &&
			!fs.existsSync(path.join(String(args[0]), String(filename)))
		) {
			return true;
		}
		return emit(event, type, filename, ...rest);
	};
	return watcher;
};

const Watchpack = require("../lib");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(10000);

describe("Rescan after the event source restarts", () => {
	beforeEach((done) => {
		dropRemovalOf = undefined;
		testHelper.before(done);
	});

	/** @type {InstanceType<typeof Watchpack>[]} */
	let watchers = [];

	afterEach((done) => {
		// closed here, not in the test, so a failure cannot leave one running
		for (const w of watchers) w.close();
		watchers = [];
		testHelper.after(done);
	});

	afterAll(() => {
		fs.watch = realWatch;
	});

	it("should report a removal whose event was lost", (done) => {
		testHelper.file("a");
		testHelper.dir("other");
		const file = path.join(fixtures, "a");
		const w = new Watchpack({ aggregateTimeout: 50 });
		watchers.push(w);
		let finished = false;
		w.on("remove", (item) => {
			finished = true;
			expect(item).toBe(file);
			done();
		});
		w.watch({ files: [file] });
		testHelper.tick(() => {
			dropRemovalOf = "a";
			testHelper.unlink("a");
			testHelper.tick(() => {
				// polling reports the removal by itself, before any restart
				if (finished) return;
				// a watcher starting is what restarts the event source on macOS
				const started = new Watchpack({});
				watchers.push(started);
				started.watch({ directories: [path.join(fixtures, "other")] });
			});
		});
	});
});
