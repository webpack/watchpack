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
	this.timeout(240000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should watch more than 4096 directories", done => {
		const files = [];
		for (let i = 1; i <= 5000; i++) {
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
		testHelper.tick(1000, () => {
			const w = new Watchpack({
				aggregateTimeout: 1000
			});
			w.on("aggregated", function(changes) {
				Array.from(changes).should.be.eql([
					path.join(fixtures, "4096/900/file")
				]);
				w.close();
				done();
			});
			for (let i = 100; i < files.length; i += 987) {
				for (let j = 0; j < files.length - i; j += 987) {
					w.watch({ files: files.slice(j, j + i) });
				}
			}
			w.watch({ files });
			testHelper.tick(10000, () => {
				testHelper.file("4096/900/file");
			});
		});
	});
});
