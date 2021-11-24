/*globals describe it beforeEach afterEach */
"use strict";

require("should");
const path = require("path");
const TestHelper = require("./helpers/TestHelper");
const Watchpack = require("../lib/watchpack");
const watchEventSource = require("../lib/watchEventSource");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

describe("ManyWatchers", function() {
	this.timeout(600000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should watch more than 4096 directories", done => {
		console.time("creating files");
		// windows is very slow in creating so many files
		// this can take about 1 minute
		const files = [];
		for (let i = 1; i < 5000; i++) {
			let highBit = 1;
			let j = i;
			while (j > 1) {
				highBit <<= 1;
				j >>= 1;
			}
			const dir = `${i & highBit}/${i & ~highBit}`;
			if (i === highBit) {
				testHelper.dir(`${i}`);
				testHelper.file(`${i}/file`);
				files.push(path.join(fixtures, `${i}`, "file"));
			}
			testHelper.dir(dir);
			testHelper.file(`${dir}/file`);
			files.push(path.join(fixtures, dir, "file"));
			if (i === highBit) {
				testHelper.file(`${dir}/file2`);
				files.push(path.join(fixtures, dir, "file2"));
			}
		}
		testHelper.file("file");
		files.push(path.join(fixtures, "file"));
		console.timeEnd("creating files");
		testHelper.tick(10000, () => {
			const w = new Watchpack({
				aggregateTimeout: 1000
			});
			w.on("aggregated", function(changes) {
				console.timeEnd("detecting change event");
				Array.from(changes).should.be.eql([
					path.join(fixtures, "4096/900/file")
				]);
				w.close();
				done();
			});
			console.time("creating/closing watchers");
			// MacOS is very slow in creating and destroying watchers
			// This can take about 2 minutes
			for (let i = 100; i < files.length; i += 2432) {
				for (let j = 0; j < files.length - i; j += 987) {
					w.watch({ files: files.slice(j, j + i) });
				}
			}
			w.watch({ files });
			console.timeEnd("creating/closing watchers");
			console.time("calling watch with the same files");
			for (let i = 0; i < 2000; i++) {
				w.watch({ files });
			}
			console.timeEnd("calling watch with the same files");

			testHelper.tick(10000, () => {
				console.time("detecting change event");
				testHelper.file("4096/900/file");
			});
		});
	});
});
