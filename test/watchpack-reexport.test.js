"use strict";

describe("watchpack re-export", () => {
	it("should re-export the same class as the main entry", () => {
		const WatchpackMain = require("../lib");
		const WatchpackAlt = require("../lib/watchpack");

		expect(WatchpackAlt).toBe(WatchpackMain);
		const instance = new WatchpackAlt();
		expect(instance).toBeInstanceOf(WatchpackMain);
		instance.close();
	});
});
