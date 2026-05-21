# AGENTS.md

Contributor conventions for this repo live in [`CONTRIBUTING.md`](./CONTRIBUTING.md). **Read it end-to-end before opening a PR.** This file only highlights what reviewers and automation will not fix for you.

Failure modes that most often trip agents here:

- **Forgetting `pnpm changeset`.** Pull requests that touch `codemods/` need a changeset covering each changed package (or the `skip-changeset` label). CI enforces this. See _Adding a changeset_ in `CONTRIBUTING.md`.
- **Editing `version` in `codemod.yaml` by hand.** The `version` field in `codemod.yaml` is synced automatically from `package.json` by `scripts/sync-codemod-versions.sh` when `pnpm run version-packages` runs. Only edit `version` in `package.json` (via changesets). See _Release workflow_ in `CONTRIBUTING.md`.
- **Skipping local checks.** Run `pnpm run format`, `pnpm run lint`, and `pnpm run ci` before you call the task done. See _Development setup_ and _CI_ in `CONTRIBUTING.md`.

Before declaring a task done, confirm layout and naming under _Adding a new codemod_ and _Package shape_ in `CONTRIBUTING.md`, and update fixtures whenever behavior changes.
