module.exports = {
	env: {
		node: true,
		es6: true
	},
	extends: ["plugin:prettier/recommended"],
	parserOptions: {
		ecmaVersion: 2018
	},
	plugins: ["prettier"],
	rules: {
		strict: 0,
		curly: 0,
		"no-underscore-dangle": 0
	}
};
