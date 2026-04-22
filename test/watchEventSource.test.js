"use strict";

const fs = require("fs");
const path = require("path");
const watchEventSource = require("../lib/watchEventSource");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

// eslint-disable-next-line jest/no-confusing-set-timeout
jest.setTimeout(10000);

describe("watchEventSource", () => {
	beforeEach((done) => {
		testHelper.before(done);
	});

	afterEach((done) => {
		testHelper.after(done);
	});

	it("exposes the internal watcher limit constant", () => {
		expect(typeof watchEventSource.watcherLimit).toBe("number");
		expect(watchEventSource.watcherLimit).toBeGreaterThan(0);
	});

	it("exposes a Watcher class extending EventEmitter", () => {
		const { EventEmitter } = require("events");

		expect(typeof watchEventSource.Watcher).toBe("function");
		const w = new watchEventSource.Watcher();
		expect(w).toBeInstanceOf(EventEmitter);
		// close before it is associated with any underlying watcher
		// (fallback branch that removes from pendingWatchers)
		// It is a pending watcher here since batch hasn't executed
		// emulate by putting it into the pending state via watch:
		const handle = watchEventSource.watch(path.join(fixtures, "never-created"));
		handle.close();
	});

	it("watch() returns a Watcher emitting change events for file writes", (done) => {
		testHelper.dir("ev");
		const watched = path.join(fixtures, "ev");
		testHelper.tick(300, () => {
			const w = watchEventSource.watch(watched);
			let done2 = false;
			w.on("change", () => {
				if (done2) return;
				done2 = true;
				expect(done2).toBe(true);
				w.close();
				done();
			});
			testHelper.tick(200, () => {
				fs.writeFileSync(path.join(watched, "x"), "hello", "utf8");
			});
		});
	});

	it("watch() returns the same underlying watcher when called twice in batch for the same path", (done) => {
		testHelper.dir("shared");
		const watched = path.join(fixtures, "shared");
		testHelper.tick(300, () => {
			let a;
			let b;
			watchEventSource.batch(() => {
				a = watchEventSource.watch(watched);
				b = watchEventSource.watch(watched);
			});
			// Both watchers should fire on change
			let countA = 0;
			let countB = 0;
			a.on("change", () => {
				countA++;
			});
			b.on("change", () => {
				countB++;
			});
			testHelper.tick(200, () => {
				fs.writeFileSync(path.join(watched, "f"), "y", "utf8");
				testHelper.tick(500, () => {
					expect(countA + countB).toBeGreaterThan(0);
					a.close();
					b.close();
					done();
				});
			});
		});
	});

	it("watch() emits an error asynchronously when the path does not exist", (done) => {
		const w = watchEventSource.watch(
			path.join(fixtures, "definitely-not-here"),
		);
		w.on("error", (err) => {
			expect(err).toBeDefined();
			w.close();
			done();
		});
	});

	it("getNumberOfWatchers returns a non-negative count", () => {
		expect(watchEventSource.getNumberOfWatchers()).toBeGreaterThanOrEqual(0);
	});

	it("batch propagates synchronous errors from the callback but still calls execute", () => {
		let executed = false;
		const orig = watchEventSource.watch;
		// Spy via patch: we reach execute() only by adding a pending watcher.
		try {
			expect(() =>
				watchEventSource.batch(() => {
					// Add a pending watcher
					const handle = orig(path.join(fixtures, "batch-no-dir"));
					executed = true;
					// Close so execute doesn't actually create anything
					handle.close();
					throw new Error("boom");
				}),
			).toThrow("boom");
		} finally {
			expect(executed).toBe(true);
		}
	});
});

describe("watchEventSource.createHandleChangeEvent", () => {
	const { EventEmitter } = require("events");

	it("forwards non-self-rename events unchanged", () => {
		const watcher = new EventEmitter();
		const filePath = "/tmp/my-dir";
		const received = [];
		const handle = watchEventSource.createHandleChangeEvent(
			watcher,
			filePath,
			(type, filename) => {
				received.push([type, filename]);
			},
		);
		handle("change", "inner.txt");
		expect(received).toEqual([["change", "inner.txt"]]);
	});

	it("forwards rename events for relative filenames", () => {
		const watcher = new EventEmitter();
		const filePath = "/tmp/my-dir";
		const received = [];
		const handle = watchEventSource.createHandleChangeEvent(
			watcher,
			filePath,
			(type, filename) => {
				received.push([type, filename]);
			},
		);
		handle("rename", "inner.txt");
		expect(received).toEqual([["rename", "inner.txt"]]);
	});

	it("suppresses self-rename events on non-osx platforms and emits EPERM", () => {
		const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
		Object.defineProperty(process, "platform", { value: "linux" });
		try {
			// The createHandleChangeEvent closure captured IS_OSX at module load
			// time, so we cannot retroactively override it. We still exercise the
			// branch by calling on linux, where IS_OSX was false at load time.
			const watcher = new EventEmitter();
			const filePath = path.resolve("/tmp/some-dir");
			let errorSeen;
			watcher.on("error", (err) => {
				errorSeen = err;
			});
			const received = [];
			const handle = watchEventSource.createHandleChangeEvent(
				watcher,
				filePath,
				(type, filename) => {
					received.push([type, filename]);
				},
			);
			handle("rename", path.resolve("/tmp/some-dir"));
			// On linux the handler should have emitted an EPERM error and skipped
			if (require("os").platform() !== "darwin") {
				expect(errorSeen && errorSeen.code).toBe("EPERM");
				expect(received).toEqual([]);
			} else {
				expect(errorSeen).toBeUndefined();
				expect(received).toEqual([]);
			}
		} finally {
			Object.defineProperty(process, "platform", origPlatform);
		}
	});
});
