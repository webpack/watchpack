"use strict";

/* eslint-disable no-console, n/no-unsupported-features/node-builtins, n/no-process-exit, import/no-unresolved */

// Temporary probe for #228: webpack in watch mode, a module imported with other
// casing than the file has. Every edit must reach the output, not only the first.
// Usage: node tooling/case-probe.js [path to watchpack's lib]
const fs = require("fs");
const Module = require("module");
const os = require("os");
const path = require("path");

const lib = path.resolve(process.argv[2] || path.join(__dirname, "..", "lib"));
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function _resolveFilename(request, ...args) {
	if (request === "watchpack") return path.join(lib, "index.js");
	return resolveFilename.call(this, request, ...args);
};

const webpack = require("webpack");

const EDITS = 3;
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "case-"));
const src = path.join(root, "src");
fs.mkdirSync(src);
fs.writeFileSync(
	path.join(src, "index.js"),
	'import value from "./B";\nconsole.log(value);\n',
);
const file = path.join(src, "b.js");
let version = 0;
const write = () => fs.writeFileSync(file, `export default "v${version}";\n`);
write();

const compiler = webpack({
	mode: "development",
	devtool: false,
	context: root,
	entry: "./src/index.js",
	output: { path: path.join(root, "dist") },
	infrastructureLogging: { level: "none" },
});

/** @type {(number | null)[]} */
const seen = [];
let done = false;
/** @type {import("webpack").Watching} */
let watching;

/**
 * @param {boolean} ok passed
 */
const finish = (ok) => {
	if (done) return;
	done = true;
	watching.close(() => {
		console.log(
			`${ok ? "PASS" : "FAIL"} ${lib}: outputs had v${seen.join(", v")} (wanted v0 to v${EDITS})`,
		);
		fs.rmSync(root, { recursive: true, force: true });
		process.exit(ok ? 0 : 1);
	});
};

const timeout = setTimeout(() => finish(false), 30000);

watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
	if (err || !stats || stats.hasErrors()) {
		console.log(err || (stats && stats.toString("errors-only")));
		clearTimeout(timeout);
		return finish(false);
	}
	const match = /"v(\d+)"/.exec(
		fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
	);
	const outputVersion = match ? Number(match[1]) : null;
	seen.push(outputVersion);
	if (outputVersion !== version) return;
	if (version === EDITS) {
		clearTimeout(timeout);
		return finish(true);
	}
	// later than the file system accuracy, so every edit is a new mtime
	setTimeout(() => {
		version++;
		write();
	}, 1500);
});
