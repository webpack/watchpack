// the package only has `exports`, which the import resolver does not read
// eslint-disable-next-line import/no-unresolved
import { getCommitInfo, getPullRequestInfo } from "@changesets/get-github-info";

/** @typedef {import("@changesets/types").ChangelogFunctions} ChangelogFunctions */
/** @typedef {{ commit: string | undefined, pull: string | undefined, user: string | undefined }} Links */

/**
 * @returns {{ GITHUB_SERVER_URL: string }} value
 */
function readEnv() {
	const GITHUB_SERVER_URL =
		process.env.GITHUB_SERVER_URL || "https://github.com";
	return { GITHUB_SERVER_URL };
}

/** @type {ChangelogFunctions} */
const changelogFunctions = {
	getDependencyReleaseLine: async (
		changesets,
		dependenciesUpdated,
		options,
	) => {
		if (!options.repo) {
			throw new Error(
				'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
			);
		}
		if (dependenciesUpdated.length === 0) return "";

		const changesetLink = `- Updated dependencies [${(
			await Promise.all(
				changesets.map(async (cs) => {
					if (cs.commit) {
						const info = await getCommitInfo({
							repo: /** @type {string} */ (options.repo),
							commit: cs.commit,
						});
						return info
							? info.commit.markdownLink
							: `\`${cs.commit.slice(0, 7)}\``;
					}
				}),
			)
		)
			.filter(Boolean)
			.join(", ")}]:`;

		const updatedDependenciesList = dependenciesUpdated.map(
			(dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
		);

		return [changesetLink, ...updatedDependenciesList].join("\n");
	},
	getReleaseLine: async (changeset, type, options) => {
		const { GITHUB_SERVER_URL } = readEnv();
		if (!options || !options.repo) {
			throw new Error(
				'Please provide a repo to this changelog generator like this:\n"changelog": ["@changesets/changelog-github", { "repo": "org/repo" }]',
			);
		}

		/** @type {number | undefined} */
		let prFromSummary;
		/** @type {string | undefined} */
		let commitFromSummary;
		/** @type {string[]} */
		const usersFromSummary = [];

		const replacedChangelog = changeset.summary
			.replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
				const num = Number(pr);
				if (!Number.isNaN(num)) prFromSummary = num;
				return "";
			})
			.replace(/^\s*commit:\s*([^\s]+)/im, (_, commit) => {
				commitFromSummary = commit;
				return "";
			})
			.replaceAll(/^\s*(?:author|user):\s*@?([^\s]+)/gim, (_, user) => {
				usersFromSummary.push(user);
				return "";
			})
			.trim();

		const [firstLine, ...futureLines] = replacedChangelog
			.split("\n")
			.map((l) => l.trimEnd());

		const { repo } = /** @type {{ repo: string }} */ (options);
		/** @type {Links} */
		const links = { commit: undefined, pull: undefined, user: undefined };
		if (prFromSummary !== undefined) {
			const info = await getPullRequestInfo({ repo, pull: prFromSummary });
			links.commit = info && info.commit && info.commit.markdownLink;
			links.pull = info && info.pull.markdownLink;
			links.user = info && info.author && info.author.markdownLink;
			if (commitFromSummary) {
				const shortCommitId = commitFromSummary.slice(0, 7);
				links.commit = `[\`${shortCommitId}\`](${GITHUB_SERVER_URL}/${repo}/commit/${commitFromSummary})`;
			}
		} else if (commitFromSummary || changeset.commit) {
			const info = await getCommitInfo({
				repo,
				commit: /** @type {string} */ (commitFromSummary || changeset.commit),
			});
			links.commit = info && info.commit.markdownLink;
			links.pull = info && info.pull && info.pull.markdownLink;
			links.user = info && info.author && info.author.markdownLink;
		}

		const users = usersFromSummary.length
			? usersFromSummary
					.map(
						(userFromSummary) =>
							`[@${userFromSummary}](${GITHUB_SERVER_URL}/${userFromSummary})`,
					)
					.join(", ")
			: links.user;

		let suffix = "";
		if (links.pull || links.commit || users) {
			suffix = `(${users ? `by ${users} ` : ""}in ${links.pull || links.commit})`;
		}

		return `\n\n- ${firstLine} ${suffix}\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
	},
};

export default changelogFunctions;
