import { defineConfig } from "eslint/config";
import config from "eslint-config-webpack";

export default defineConfig([
	{
		// Benchmarks are ESM-only (tinybench is ESM) and use top-level await
		// plus import.meta which the shared CJS config does not expect. They
		// are not shipped with the package so lint them out.
		ignores: ["bench/**"],
	},
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
