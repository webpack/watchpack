/* globals describe it beforeEach afterEach */
"use strict";

require("should");

const path = require("path");
const fs = require("fs");
const TestHelper = require("./helpers/TestHelper");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

const { createHandleChangeEvent } = require("../lib/watchEventSource");

const IS_OSX = require("os").platform() === "darwin";
const IS_WIN = require("os").platform() === "win32";

const SUPPORTS_RECURSIVE_WATCHING = IS_OSX || IS_WIN;

function getNodeVersion() {
	try {
		return Number.parseInt(process.version.split(".")[0].replace("v", ""), 10);
	} catch (_err) {
		return 0;
	}
}

const IS_NODE_VERSION_GT_24 = getNodeVersion() >= 24;

describe("Assumption", function assumptionTest() {
	this.timeout(10000);
	let watcherToClose = null;

	beforeEach(testHelper.before);
	afterEach((done) => {
		if (watcherToClose) {
			watcherToClose.close();
			watcherToClose = null;
		}
		testHelper.after(done);
	});

	it("should have a file system with correct mtime behavior (stats)", function singleTest(done) {
		this.timeout(20000);
		let i = 60;
		const count = 60;
		let minDiffBefore = +Infinity;
		let maxDiffBefore = -Infinity;
		let sumDiffBefore = 0;
		let minDiffAfter = +Infinity;
		let maxDiffAfter = -Infinity;
		let sumDiffAfter = 0;

		function afterMeasure() {
			// eslint-disable-next-line no-console
			console.log(
				`mtime stats accuracy (before): [${minDiffBefore} ; ${
					maxDiffBefore
				}] avg ${Math.round(sumDiffBefore / count)}`,
			);
			// eslint-disable-next-line no-console
			console.log(
				`mtime stats accuracy (after): [${minDiffAfter} ; ${
					maxDiffAfter
				}] avg ${Math.round(sumDiffAfter / count)}`,
			);
			minDiffBefore.should.be.aboveOrEqual(-2000);
			maxDiffBefore.should.be.below(2000);
			minDiffAfter.should.be.aboveOrEqual(-2000);
			maxDiffAfter.should.be.below(2000);
			done();
		}

		testHelper.tick(100, function checkMtime() {
			const before = Date.now();
			testHelper.file("a");
			const after = Date.now();
			const stats = fs.statSync(path.join(fixtures, "a"));
			const diffBefore = +stats.mtime - before;
			if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
			if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
			sumDiffBefore += diffBefore;
			const diffAfter = +stats.mtime - after;
			if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
			if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
			sumDiffAfter += diffAfter;
			if (i-- === 0) {
				afterMeasure();
			} else {
				testHelper.tick(100, checkMtime);
			}
		});
	});

	it("should have a file system with correct mtime behavior (fs.watch)", function singleTest(done) {
		this.timeout(20000);
		testHelper.file("a");
		let i = 60;
		const count = 60;
		let before;
		let after;
		let minDiffBefore = +Infinity;
		let maxDiffBefore = -Infinity;
		let sumDiffBefore = 0;
		let minDiffAfter = +Infinity;
		let maxDiffAfter = -Infinity;
		let sumDiffAfter = 0;

		function afterMeasure() {
			// eslint-disable-next-line no-console
			console.log(
				`mtime fs.watch accuracy (before): [${minDiffBefore} ; ${
					maxDiffBefore
				}] avg ${Math.round(sumDiffBefore / count)}`,
			);
			// eslint-disable-next-line no-console
			console.log(
				`mtime fs.watch accuracy (after): [${minDiffAfter} ; ${
					maxDiffAfter
				}] avg ${Math.round(sumDiffAfter / count)}`,
			);
			minDiffBefore.should.be.aboveOrEqual(-2000);
			maxDiffBefore.should.be.below(2000);
			minDiffAfter.should.be.aboveOrEqual(-2000);
			maxDiffAfter.should.be.below(2000);
			done();
		}

		function checkMtime() {
			before = Date.now();
			testHelper.file("a");
			after = Date.now();
		}

		const watcher = (watcherToClose = fs.watch(fixtures));
		testHelper.tick(100, () => {
			watcher.on("change", (type, filename) => {
				const stats = fs.statSync(path.join(fixtures, filename));
				if (before && after) {
					const diffBefore = +stats.mtime - before;
					if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
					if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
					sumDiffBefore += diffBefore;
					const diffAfter = +stats.mtime - after;
					if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
					if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
					sumDiffAfter += diffAfter;
					before = after = undefined;
					if (i-- === 0) {
						afterMeasure();
					} else {
						testHelper.tick(100, checkMtime);
					}
				}
			});
			testHelper.tick(100, checkMtime);
		});
	});

	if (SUPPORTS_RECURSIVE_WATCHING) {
		it("should have a file system with correct mtime behavior (fs.watch recursive)", function singleTest(done) {
			this.timeout(20000);
			testHelper.file("a");
			let i = 60;
			const count = 60;
			let before;
			let after;
			let minDiffBefore = +Infinity;
			let maxDiffBefore = -Infinity;
			let sumDiffBefore = 0;
			let minDiffAfter = +Infinity;
			let maxDiffAfter = -Infinity;
			let sumDiffAfter = 0;

			function afterMeasure() {
				// eslint-disable-next-line no-console
				console.log(
					`mtime fs.watch({ recursive: true }) accuracy (before): [${
						minDiffBefore
					} ; ${maxDiffBefore}] avg ${Math.round(sumDiffBefore / count)}`,
				);
				// eslint-disable-next-line no-console
				console.log(
					`mtime fs.watch({ recursive: true }) accuracy (after): [${
						minDiffAfter
					} ; ${maxDiffAfter}] avg ${Math.round(sumDiffAfter / count)}`,
				);
				minDiffBefore.should.be.aboveOrEqual(-2000);
				maxDiffBefore.should.be.below(2000);
				minDiffAfter.should.be.aboveOrEqual(-2000);
				maxDiffAfter.should.be.below(2000);
				done();
			}

			function checkMtime() {
				before = Date.now();
				testHelper.file("a");
				after = Date.now();
			}

			const watcher = (watcherToClose = fs.watch(fixtures, {
				recursive: true,
			}));
			testHelper.tick(100, () => {
				watcher.on("change", (type, filename) => {
					const stats = fs.statSync(path.join(fixtures, filename));
					if (before && after) {
						const diffBefore = +stats.mtime - before;
						if (diffBefore < minDiffBefore) minDiffBefore = diffBefore;
						if (diffBefore > maxDiffBefore) maxDiffBefore = diffBefore;
						sumDiffBefore += diffBefore;
						const diffAfter = +stats.mtime - after;
						if (diffAfter < minDiffAfter) minDiffAfter = diffAfter;
						if (diffAfter > maxDiffAfter) maxDiffAfter = diffAfter;
						sumDiffAfter += diffAfter;
						before = after = undefined;
						if (i-- === 0) {
							afterMeasure();
						} else {
							testHelper.tick(100, checkMtime);
						}
					}
				});
				testHelper.tick(100, checkMtime);
			});
		});
	}

	it("should not fire events in subdirectories", (done) => {
		testHelper.dir("watch-test-directory");
		testHelper.tick(500, () => {
			const watcher = (watcherToClose = fs.watch(fixtures));
			watcher.on("change", (arg, arg2) => {
				done(new Error(`should not be emitted ${arg} ${arg2}`));
				done = function () {};
			});
			watcher.on("error", (err) => {
				done(err);
				done = function () {};
			});
			testHelper.tick(500, () => {
				testHelper.file("watch-test-directory/watch-test-file");
				testHelper.tick(500, () => {
					done();
				});
			});
		});
	});

	if (SUPPORTS_RECURSIVE_WATCHING) {
		it("should fire events in subdirectories (recursive)", (done) => {
			testHelper.dir("watch-test-directory");
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.file("watch-test-directory/existing-file");
			testHelper.tick(500, () => {
				const watcher = (watcherToClose = fs.watch(fixtures, {
					recursive: true,
				}));
				const events = [];
				watcher.once("change", () => {
					testHelper.tick(1000, () => {
						events.should.matchAny(/watch-test-directory[/\\]watch-test-file/);
						done();
					});
				});
				watcher.on("change", (type, filename) => {
					events.push(filename);
				});
				watcher.on("error", (err) => {
					done(err);
					done = function () {};
				});
				testHelper.tick(500, () => {
					testHelper.file("watch-test-directory/watch-test-file");
				});
			});
		});

		it("should allow to create/close/create recursive watchers", (done) => {
			testHelper.dir("watch-test-directory");
			testHelper.file("watch-test-directory/watch-test-file");
			testHelper.file("watch-test-directory/existing-file");
			testHelper.tick(500, () => {
				watcherToClose = fs.watch(fixtures, {
					recursive: true,
				});
				watcherToClose.close();
				watcherToClose = fs.watch(fixtures, {
					recursive: true,
				});
				watcherToClose.close();
				watcherToClose = fs.watch(fixtures, {
					recursive: true,
				});
				watcherToClose.close();
				const watcher = (watcherToClose = fs.watch(fixtures, {
					recursive: true,
				}));
				const events = [];
				watcher.once("change", () => {
					testHelper.tick(1000, () => {
						events.should.matchAny(/watch-test-directory[/\\]watch-test-file/);
						done();
					});
				});
				watcher.on("change", (type, filename) => {
					events.push(filename);
				});
				watcher.on("error", (err) => {
					done(err);
					done = function () {};
				});
				testHelper.tick(500, () => {
					testHelper.file("watch-test-directory/watch-test-file");
				});
			});
		});
	}

	if (!IS_OSX) {
		it("should detect removed directory", (done) => {
			testHelper.dir("watch-test-dir");
			testHelper.tick(() => {
				const watcher = (watcherToClose = fs.watch(
					path.join(fixtures, "watch-test-dir"),
				));
				let gotSelfRename = false;
				let gotPermError = false;
				const handleChangeEvent = createHandleChangeEvent(
					watcher,
					path.join(fixtures, "watch-test-dir"),
					(type, filename) => {
						if (type === "rename" && filename === "watch-test-dir") {
							gotSelfRename = true;
						}
					},
				);
				watcher.on("change", handleChangeEvent);
				watcher.on("error", (err) => {
					if (err && err.code === "EPERM") gotPermError = true;
				});
				testHelper.tick(500, () => {
					testHelper.remove("watch-test-dir");
					testHelper.tick(3000, () => {
						if (gotPermError || gotSelfRename) {
							done();
						} else {
							done(new Error("Didn't receive a event about removed directory"));
						}
					});
				});
			});
		});
	}

	if (IS_WIN) {
		it("should return EINVAL when lstat a directory on Windows", (done) => {
			fs.lstat("D:\\System Volume Information", (err) => {
				err.code.should.be.equal(IS_NODE_VERSION_GT_24 ? "EINVAL" : "EPERM");
				done();
			});
		});
	}

	for (const delay of [100, 200, 300, 500, 700, 1000].reverse()) {
		// eslint-disable-next-line no-loop-func
		it(`should fire events not after start and ${delay}ms delay`, (done) => {
			testHelper.file(`watch-test-file-${delay}`);
			testHelper.tick(delay, () => {
				const watcher = (watcherToClose = fs.watch(fixtures));
				watcher.on("change", (arg) => {
					done(new Error(`should not be emitted ${arg}`));
					done = function () {};
				});
				watcher.on("error", (err) => {
					done(err);
					done = function () {};
				});
				testHelper.tick(500, () => {
					done();
				});
			});
		});
	}
});
