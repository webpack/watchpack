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

	it("should detect removed directory", function(done) {
		var w = new Watchpack({
			aggregateTimeout: 1000,
			poll: false,           
			followSymlinks: false,
			ignored: ['**/node_modules/**', '**/.git/**'] 
		});
		var changeEvents = [];
		w.on("change", function(filePath, mtime, explanation) {
			console.log(">>> change: ", filePath, mtime, explanation)
		});
		w.on("remove", function(filePath, explanation) {
			console.log(">>> remove: ", filePath, explanation)
		});
		w.on("error", function(err) {	
			console.log(">>> error: ", err)
		});
		w.on("aggregated", function(changes) {
			console.log(">>> aggregated: ", changes)
			w.close();
			done();
		});
		testHelper.dir("dir");
		testHelper.tick(200, function() {
			w.watch({
				directories: [path.join(fixtures, "dir")],  // 要监听的目录列表
				missing: [],             // 要监听但可能不存在的文件列表
				startTime: Date.now()    // 开始时间，只监听这个时间之后的变化
			});
			testHelper.tick(200, function() {
				testHelper.remove("dir");
			});
		});
	});
});
