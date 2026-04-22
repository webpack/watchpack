"use strict";

const path = require("path");
const Watchpack = require("../lib");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(15000);

describe("polled Watchpack", () => {
	beforeEach((done) => {
		testHelper.before(done);
	});

	afterEach((done) => {
		testHelper.after(done);
	});

	it("should set poll:true as the poll option", (done) => {
		const w = new Watchpack({
			aggregateTimeout: 100,
			poll: true,
		});
		expect(w.watcherOptions.poll).toBe(true);
		w.watch([], []);
		testHelper.tick(300, () => {
			w.close();
			done();
		});
	});

	it("should accept a numeric poll interval", (done) => {
		const w = new Watchpack({
			aggregateTimeout: 100,
			poll: 200,
		});
		expect(w.watcherOptions.poll).toBe(200);
		w.watch([], []);
		testHelper.tick(300, () => {
			w.close();
			done();
		});
	});

	it("should detect a file creation on an existing file in polled mode", (done) => {
		testHelper.file("a");
		testHelper.tick(500, () => {
			const w = new Watchpack({
				aggregateTimeout: 100,
				poll: 150,
			});
			w.once("aggregated", (changes) => {
				expect([...changes]).toContain(path.join(fixtures, "a"));
				w.close();
				done();
			});
			w.watch([path.join(fixtures, "a")], [], Date.now() - 10000);
			testHelper.tick(300, () => {
				testHelper.file("a");
			});
		});
	});

	it("should detect a file removal in polled mode", (done) => {
		testHelper.file("a");
		testHelper.tick(300, () => {
			const w = new Watchpack({
				aggregateTimeout: 100,
				poll: 150,
			});
			w.on("aggregated", (_changes, removals) => {
				if (!removals.has(path.join(fixtures, "a"))) return;
				expect([...removals]).toContain(path.join(fixtures, "a"));
				w.close();
				done();
			});
			w.watch([path.join(fixtures, "a")], []);
			testHelper.tick(300, () => {
				testHelper.remove("a");
			});
		});
	});
});
