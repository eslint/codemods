# AGENTS.md

Contributor conventions for this repo live in [`CONTRIBUTING.md`](./CONTRIBUTING.md). **Read it end-to-end before opening a PR.** This file only highlights what reviewers and automation will not fix for you.

Failure modes that most often trip agents here:

- **Forgetting `pnpm changeset`.** Pull requests that touch `codemods/` should include a changeset covering each changed package (or the `skip-changeset` label). CI warns but does not fail when changesets are missing. See _Adding a changeset_ in `CONTRIBUTING.md`.
- **Editing `version` in `package.json` by hand.** Version bumps come from changesets when `pnpm run version-packages` runs. See _Release workflow_ in `CONTRIBUTING.md`.
- **Skipping local checks.** Run `pnpm run format`, `pnpm run lint`, and `pnpm run ci` before you call the task done. See _Development setup_ and _CI_ in `CONTRIBUTING.md`.

Before declaring a task done, confirm layout and naming under _Adding a new codemod_ and _Package shape_ in `CONTRIBUTING.md`, and update fixtures whenever behavior changes.
