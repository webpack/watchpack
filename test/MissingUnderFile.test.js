"use strict";

const path = require("path");
const Watchpack = require("../lib");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(20000);

describe("Missing file below a path that is a file (#226)", () => {
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

	it("should report the file once its parent turns from a file into a directory", (done) => {
		// a resolver tried `foo/index.js` while `foo` is a file
		testHelper.file("foo");
		const missing = path.join(fixtures, "foo", "index.js");
		const errors = jest.spyOn(console, "error").mockImplementation(() => {});
		testHelper.tick(1000, () => {
			const w = new Watchpack({ aggregateTimeout: 100 });
			watchers.push(w);
			w.on("change", (item) => {
				expect(item).toBe(missing);
				expect(errors).not.toHaveBeenCalled();
				done();
			});
			w.watch({ missing: [missing], startTime: Date.now() });
			testHelper.tick(1000, () => {
				testHelper.remove("foo");
				testHelper.dir("foo");
				testHelper.file(path.join("foo", "index.js"));
			});
		});
	});
});
