/*globals describe it beforeEach afterEach */
"use strict";

require("should");
const path = require("path");
const TestHelper = require("./helpers/TestHelper");
const Watchpack = require("../lib/watchpack");

const fixtures = path.join(__dirname, "fixtures");
const testHelper = new TestHelper(fixtures);

describe("ManyWatchers", function() {
	this.timeout(180000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should watch more than 4096 directories", done => {
		const files = [];
		for (let i = 0; i < 5000; i++) {
			const dir = `${Math.floor(i / 100)}/${i % 100}`;
			if (i % 100 === 0) testHelper.dir(`${Math.floor(i / 100)}`);
			testHelper.dir(dir);
			testHelper.file(`${dir}/file`);
			files.push(path.join(fixtures, dir, "file"));
		}
		testHelper.tick(1000, () => {
			const w = new Watchpack({
				aggregateTimeout: 1000
			});
			w.on("aggregated", function(changes) {
				Array.from(changes).should.be.eql([path.join(fixtures, "49/49/file")]);
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
				testHelper.file("49/49/file");
			});
		});
	});
});
