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
	const watcher = realWatch.apply(fs, /** @type {EXPECTED_ANY} */ (args));
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

	afterEach((done) => {
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
		/** @type {Watchpack | undefined} */
		let other;
		w.on("remove", (item) => {
			expect(item).toBe(file);
			w.close();
			/** @type {Watchpack} */
			(other).close();
			done();
		});
		w.watch({ files: [file] });
		testHelper.tick(() => {
			dropRemovalOf = "a";
			testHelper.unlink("a");
			testHelper.tick(() => {
				// a watcher starting is what restarts the event source on macOS
				other = new Watchpack({});
				other.watch({ directories: [path.join(fixtures, "other")] });
			});
		});
	});
});
