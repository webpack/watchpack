/*globals describe it beforeEach afterEach */
"use strict";

require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var Watchpack = require("../lib/watchpack");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("Watchpack", function() {
	this.timeout(10000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should watch a single file", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = 0;
		w.on("change", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "a")]);
			changeEvents.should.be.greaterThan(0);
			w.close();
			done();
		});
		w.watch([path.join(fixtures, "a")], []);
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});

	it("should not watch a single ignored file", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 300,
			ignored: "**/a"
		});
		var changeEvents = 0;
		var aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		w.watch([path.join(fixtures, "a")], []);
		testHelper.tick(() => {
			testHelper.file("a");
			testHelper.tick(1000, () => {
				changeEvents.should.be.eql(0);
				aggregatedEvents.should.be.eql(0);
				testHelper.getNumberOfWatchers().should.be.eql(0);
				w.close();
				done();
			});
		});
	});

	it("should watch multiple files", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes)
				.sort()
				.should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b")]);
			changeEvents.should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b"), path.join(fixtures, "a"), path.join(fixtures, "b"), path.join(fixtures, "a")]);
			Object.keys(w.getTimes())
				.sort()
				.should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b")]);
			w.close();
			done();
		});
		w.watch([path.join(fixtures, "a"), path.join(fixtures, "b")], []);
		testHelper.tick(400, function() {
			testHelper.file("a");
			testHelper.tick(400, function() {
				testHelper.file("b");
				testHelper.tick(400, function() {
					testHelper.file("a");
					testHelper.tick(400, function() {
						testHelper.file("b");
						testHelper.tick(400, function() {
							testHelper.file("a");
						});
					});
				});
			});
		});
	});

	it("should watch a directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(200, function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, function() {
				testHelper.file(path.join("dir", "a"));
			});
		});
	});

	it("should not watch an ignored directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 300,
			ignored: ["**/dir"]
		});
		var changeEvents = 0;
		var aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		testHelper.dir("dir");
		testHelper.tick(200, function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, function() {
				testHelper.file(path.join("dir", "a"));
				testHelper.tick(1000, function() {
					changeEvents.should.be.eql(0);
					aggregatedEvents.should.be.eql(0);
					testHelper.getNumberOfWatchers().should.be.eql(0);
					w.close();
					done();
				});
			});
		});
	});

	it("should not watch an ignored file in a directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 300,
			ignored: ["**/a"]
		});
		var changeEvents = 0;
		var aggregatedEvents = 0;
		w.on("change", () => {
			changeEvents++;
		});
		w.on("aggregated", () => {
			aggregatedEvents++;
		});
		testHelper.dir("dir");
		testHelper.tick(200, function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(200, function() {
				testHelper.file(path.join("dir", "a"));
				testHelper.tick(1000, function() {
					changeEvents.should.be.eql(0);
					aggregatedEvents.should.be.eql(0);
					w.close();
					done();
				});
			});
		});
	});

	it("should watch a file then a directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes, removals) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			Array.from(removals).should.be.eql([]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "subdir"));
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(400, function() {
			w.watch([path.join(fixtures, "dir", "a")], []);
			testHelper.tick(function() {
				w.watch([], [path.join(fixtures, "dir")]);
				testHelper.tick(function() {
					testHelper.file(path.join("dir", "a"));
				});
			});
		});
	});

	it("should watch a directory (delete file)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "a"));
			});
		});
	});

	it("should watch a directory (delete and recreate file)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a"), path.join(fixtures, "dir", "b"), path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "a"));
				testHelper.tick(function() {
					testHelper.file(path.join("dir", "b"));
					testHelper.tick(500, function() {
						testHelper.file(path.join("dir", "a"));
					});
				});
			});
		});
	});

	it("should watch a missing directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir", "sub")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir", "sub")]);
			testHelper.tick(function() {
				testHelper.dir(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (add directory)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.dir(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (delete directory)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.file(path.join("dir", "sub", "a"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "sub"));
			});
		});
	});

	it("should watch a directory (delete, restore and change directory)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes, removals) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir", "sub", "a")]);
			Array.from(removals).should.be.eql([path.join(fixtures, "dir", "sub", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.file(path.join("dir", "sub", "a"));
		testHelper.tick(function() {
			w.watch([path.join(fixtures, "dir", "sub", "a")], []);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "sub"));
				testHelper.tick(function() {
					testHelper.dir(path.join("dir", "sub"));
					testHelper.file(path.join("dir", "sub", "a"));
				});
			});
		});
	});

	it("should watch a directory (delete directory2)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.remove(path.join("dir", "sub"));
			});
		});
	});

	it("should watch already watched directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.file(path.join("dir", "a"));
		testHelper.tick(400, function() {
			w.watch([path.join(fixtures, "dir", "a")], []);
			testHelper.tick(1000, function() {
				w.watch([], [path.join(fixtures, "dir")]);
				testHelper.tick(400, function() {
					testHelper.remove(path.join("dir", "a"));
				});
			});
		});
	});

	it("should watch file in a sub directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub", "a")]);
			var times = w.getTimeInfoEntries();
			const dir = times.get(path.join(fixtures, "dir"));
			const sub = times.get(path.join(fixtures, "dir", "sub"));
			const a = times.get(path.join(fixtures, "dir", "sub", "a"));
			dir.should.be.type("object");
			dir.should.have.property("safeTime");
			sub.safeTime.should.be.aboveOrEqual(a.safeTime);
			dir.safeTime.should.be.aboveOrEqual(sub.safeTime);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.tick(function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.file(path.join("dir", "sub", "a"));
			});
		});
	});

	it("should watch 2 files in a not-existing directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		w.on("aggregated", function(changes) {
			Array.from(changes)
				.sort()
				.should.be.eql([path.join(fixtures, "dir", "sub", "a"), path.join(fixtures, "dir", "sub", "b")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		w.watch([path.join(fixtures, "dir", "sub", "a"), path.join(fixtures, "dir", "sub", "b")], []);
		testHelper.tick(function() {
			testHelper.dir(path.join("dir", "sub"));
			testHelper.file(path.join("dir", "sub", "a"));
			testHelper.file(path.join("dir", "sub", "b"));
		});
	});

	it("should watch file in a sub sub directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub", "sub", "a")]);
			Object.keys(w.getTimes())
				.sort()
				.should.be.eql([path.join(fixtures, "dir"), path.join(fixtures, "dir", "sub"), path.join(fixtures, "dir", "sub", "sub"), path.join(fixtures, "dir", "sub", "sub", "a")]);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub"));
		testHelper.dir(path.join("dir", "sub", "sub"));
		testHelper.tick(2000, function() {
			w.watch([], [path.join(fixtures, "dir")], Date.now());
			testHelper.tick(function() {
				testHelper.file(path.join("dir", "sub", "sub", "a"));
			});
		});
	});

	it("should watch file in a directory that contains special glob characters", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = [];
		w.on("change", function(file) {
			if (changeEvents[changeEvents.length - 1] === file) return;
			changeEvents.push(file);
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "dir")]);
			changeEvents.should.be.eql([path.join(fixtures, "dir", "sub()", "a")]);
			var times = w.getTimeInfoEntries();
			const dir = times.get(path.join(fixtures, "dir"));
			const sub = times.get(path.join(fixtures, "dir", "sub()"));
			const a = times.get(path.join(fixtures, "dir", "sub()", "a"));
			sub.safeTime.should.be.aboveOrEqual(a.safeTime);
			dir.safeTime.should.be.aboveOrEqual(sub.safeTime);
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.dir(path.join("dir", "sub()"));
		testHelper.tick(2000, function() {
			w.watch([], [path.join(fixtures, "dir")]);
			testHelper.tick(function() {
				testHelper.file(path.join("dir", "sub()", "a"));
			});
		});
	});

	it("should detect a single change to future timestamps", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var w2 = new Watchpack({
			aggregateTimeout: 1000
		});
		w.on("change", function() {
			throw new Error("should not report change event");
		});
		w.on("aggregated", function() {
			throw new Error("should not report aggregated event");
		});
		testHelper.file("a");
		testHelper.tick(400, function() {
			w2.watch([path.join(fixtures, "a")], []);
			testHelper.tick(1000, function() {
				// wait for initial scan
				testHelper.mtime("a", Date.now() + 1000000);
				testHelper.tick(400, function() {
					w.watch([path.join(fixtures, "a")], []);
					testHelper.tick(1000, function() {
						w2.close();
						w.close();
						done();
					});
				});
			});
		});
	});

	it("should detect a past change to a file (timestamp)", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var changeEvents = 0;
		w.on("change", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "a")]);
			changeEvents.should.be.greaterThan(0);
			w.close();
			done();
		});
		var startTime = Date.now();
		testHelper.tick(function() {
			testHelper.file("a");
			testHelper.tick(function() {
				w.watch([path.join(fixtures, "a")], [], startTime);
			});
		});
	});

	it("should not detect a past change to a file (watched)", function(done) {
		var w2 = new Watchpack();
		var w = new Watchpack();
		w.on("change", function() {
			throw new Error("Should not be detected");
		});
		testHelper.tick(function() {
			testHelper.file("b");
			w2.watch([path.join(fixtures, "b")], []);
			testHelper.tick(1000, function() {
				// wait for stable state
				testHelper.file("a");
				testHelper.tick(1000, function() {
					var startTime = Date.now();
					testHelper.tick(400, function() {
						w.watch([path.join(fixtures, "a")], [], startTime);
						testHelper.tick(1000, function() {
							w.close();
							w2.close();
							done();
						});
					});
				});
			});
		});
	});

	it("should detect a past change to a file (watched)", function(done) {
		var w2 = new Watchpack();
		var w = new Watchpack();
		var changeEvents = 0;
		w.on("change", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			changeEvents++;
		});
		w.on("aggregated", function(changes) {
			Array.from(changes).should.be.eql([path.join(fixtures, "a")]);
			changeEvents.should.be.eql(1);
			w.close();
			w2.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("b");
			w2.watch([path.join(fixtures, "b")], []);
			testHelper.tick(function() {
				var startTime = Date.now();
				testHelper.tick(function() {
					testHelper.file("a");
					testHelper.tick(400, function() {
						w.watch([path.join(fixtures, "a")], [], startTime);
					});
				});
			});
		});
	});

	it("should watch a single file removal", function(done) {
		testHelper.file("a");
		var w = new Watchpack({
			aggregateTimeout: 1000
		});
		var removeEvents = 0;
		w.on("remove", function(file) {
			file.should.be.eql(path.join(fixtures, "a"));
			removeEvents++;
		});
		w.on("aggregated", function(changes, removals) {
			Array.from(removals).should.be.eql([path.join(fixtures, "a")]);
			removeEvents.should.be.eql(1);
			w.close();
			done();
		});
		testHelper.tick(400, function() {
			w.watch([path.join(fixtures, "a")], []);
			testHelper.tick(function() {
				testHelper.remove("a");
			});
		});
	});

	it("should watch multiple file removals", function(done) {
		var step = 0;
		testHelper.file("a");
		testHelper.file("b");
		var w = new Watchpack({
			aggregateTimeout: 3000
		});
		var removeEvents = [];
		w.on("remove", function(file) {
			if (removeEvents[removeEvents.length - 1] === file) return;
			removeEvents.push(file);
		});
		w.on("aggregated", function(changes, removals) {
			step.should.be.eql(6);
			Array.from(removals)
				.sort()
				.should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b")]);
			if (!+process.env.WATCHPACK_POLLING) {
				removeEvents.should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b"), path.join(fixtures, "a"), path.join(fixtures, "b")]);
			}
			Object.keys(w.getTimes())
				.sort()
				.should.be.eql([path.join(fixtures, "a"), path.join(fixtures, "b")]);
			w.close();
			done();
		});
		testHelper.tick(400, function() {
			w.watch([path.join(fixtures, "a"), path.join(fixtures, "b")], []);
			step = 1;
			testHelper.tick(1000, function() {
				testHelper.remove("a");
				step = 2;
				testHelper.tick(function() {
					testHelper.remove("b");
					step = 3;
					testHelper.tick(1000, function() {
						testHelper.file("a");
						testHelper.file("b");
						step = 4;
						testHelper.tick(1000, function() {
							testHelper.remove("a");
							step = 5;
							testHelper.tick(function() {
								testHelper.remove("b");
								step = 6;
							});
						});
					});
				});
			});
		});
	});
});
