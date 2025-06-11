import { defineConfig } from "eslint/config";
import config from "eslint-config-webpack";

export default defineConfig([
	{
		extends: [config],
		rules: {
			// TODO remove in the next major release
			"no-implicit-coercion": ["error", { number: false }],

			"id-length": [
				"error",
				{
					min: 2,
					max: Number.POSITIVE_INFINITY,
					properties: "never",
					exceptions: [
						// Watcher
						"w",
						// jQuery
						"$",
						// Loops
						"i",
						"j",
						"k",
						"v",
						"m",
						"n",
						"t",
						// Left and right
						"l",
						"r",
						// Lodash
						"_",
						// Comparison
						"a",
						"b",
					],
				},
			],
			"n/prefer-node-protocol": "off",
		},
	},
]);
