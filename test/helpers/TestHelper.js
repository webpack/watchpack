var fs = require("fs");
var path = require("path");
var rimraf = require("rimraf");

function TestHelper(testdir) {
	this.testdir = testdir;
	var self = this;
	this.before = function(done) {
		self._before(done);
	};
	this.after = function(done) {
		self._after(done);
	};
}
module.exports = TestHelper;

TestHelper.prototype._before = function before(done) {
	this.tick(function() {
		rimraf.sync(this.testdir);
		fs.mkdirSync(this.testdir);
		done();
	}.bind(this));
};

TestHelper.prototype._after = function after(done) {
	this.tick(function() {
		rimraf.sync(this.testdir);
		done();
	}.bind(this));
};

TestHelper.prototype.dir = function dir(name) {
	fs.mkdirSync(path.join(this.testdir, name));
};

TestHelper.prototype.file = function file(name) {
	fs.writeFileSync(path.join(this.testdir, name), Math.random() + "", "utf-8");
};

TestHelper.prototype.remove = function remove(name) {
	rimraf.sync(path.join(this.testdir, name));
};

TestHelper.prototype.tick = function tick(fn) {
	// setTimeout(fn, 100);
	setTimeout(function() {
		// console.log("tick");
		fn();
	}, 100);
};