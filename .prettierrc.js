module.exports = {
	printWidth: 80,
	useTabs: true,
	tabWidth: 2,
	overrides: [
		{
			files: "*.{json,yml}",
			options: {
				useTabs: false
			}
		}
	]
};
