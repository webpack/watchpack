var should = require("should");
var path = require("path");
var TestHelper = require("./helpers/TestHelper");
var DirectoryWatcher = require("../lib/DirectoryWatcher");

var fixtures = path.join(__dirname, "fixtures");
var testHelper = new TestHelper(fixtures);

describe("DirectoryWatcher", function() {
	this.timeout(5000);
	beforeEach(testHelper.before);
	afterEach(testHelper.after);

	it("should detect a file creation", function(done) {
		var d = new DirectoryWatcher(fixtures);
		var a = d.watch(path.join(fixtures, "a"));
		a.on("change", function(mtime) {
			mtime.should.be.type("number");
			a.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});
	
	it("should detect a file change", function(done) {
		var d = new DirectoryWatcher(fixtures);
		testHelper.file("a");
		var a = d.watch(path.join(fixtures, "a"));
		a.on("change", function(mtime) {
			mtime.should.be.type("number");
			a.close();
			done();
		});
		testHelper.tick(function() {
			testHelper.file("a");
		});
	});
	
	it("should not detect a file change in initial scan", function(done) {
		testHelper.file("a");
		testHelper.tick(function() {
			var d = new DirectoryWatcher(fixtures);
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function(mtime) {
				throw new Error("should not be detected");
			});
			testHelper.tick(function() {
				a.close();
				done();
			});
		});
	});
	
	it("should detect a file change in initial scan with start date", function(done) {
		var start = new Date();
		testHelper.file("a");
		testHelper.tick(function() {
			var d = new DirectoryWatcher(fixtures);
			var a = d.watch(path.join(fixtures, "a"), start);
			a.on("change", function(mtime) {
				a.close();
				done();
			});
		});
	});
	
	it("should detect a file change in initial scan without start date", function(done) {
		testHelper.file("a");
		testHelper.tick(function() {
			var d = new DirectoryWatcher(fixtures);
			var a = d.watch(path.join(fixtures, "a"));
			a.on("change", function(mtime) {
				throw new Error("should not be detected");
			});
			testHelper.tick(function() {
				a.close();
				done();
			});
		});
	});
	
	it("should detect multiple file changes", function(done) {
		var d = new DirectoryWatcher(fixtures);
		testHelper.file("a");
		testHelper.tick(function() {
			var a = d.watch(path.join(fixtures, "a"));
			var count = 20;
			var wasChanged = false;
			a.on("change", function(mtime) {
				mtime.should.be.type("number");
				if(!wasChanged) return;
				wasChanged = false;
				if(count-- <= 0) {
					a.close();
					done();
				} else {
					testHelper.tick(function() {
						wasChanged = true;
						testHelper.file("a");
					});
				}
			});
			testHelper.tick(function() {
				wasChanged = true;
				testHelper.file("a");
			});
		});
	});
});