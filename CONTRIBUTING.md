# Contributing

Thanks for helping users adopt the latest ESLint features with your codemods!

Using an AI coding agent (Codex, Cursor, Claude Code, Aider, etc.)? See [`AGENTS.md`](./AGENTS.md) — it is a short pointer back to this file and the common mistakes to avoid.

## Development setup

This repository uses **pnpm** (see `packageManager` in the root `package.json`), **Changesets** for releases, and **Biome** (not Prettier/ESLint) for formatting and linting.

```bash
# Install dependencies (also wires the Husky pre-commit hook)
pnpm install

# Format all files
pnpm run format

# Check formatting without writing
pnpm run format:check

# Lint all files
pnpm run lint

# Lint and auto-fix
pnpm run lint:fix

# Run all codemod package tests
pnpm run test

# Typecheck all codemod packages
pnpm run check-types

# Same checks as CI (tests + typecheck)
pnpm run ci

# Verify URLs in tracked Markdown (also runs in CI)
pnpm run docs:links
```

Run one workspace package (the `pnpm --filter` value is the `name` field in that package's `package.json`):

```bash
pnpm --filter <package-name> test
pnpm --filter <package-name> check-types
```

For example:

```bash
pnpm --filter @eslint/v8-to-v9-config test
pnpm --filter @eslint/v8-to-v9-custom-rules check-types
```

Use Node **22** locally (see [`.nvmrc`](./.nvmrc)) to match CI.

## Pre-commit hook

After `pnpm install`, Husky runs **lint-staged** before each commit: Biome format and lint on staged files, plus targeted `pnpm test` when you touch `codemods/**/scripts/*.ts`. If something fails, fix or stage the updates and try again.

The hook only inspects **staged** files. Files you did not touch can still fail a full-repo `pnpm run format:check` / `pnpm run lint` — CI focuses on **changed** paths for pull requests.

## CI

Three workflows run on every PR and push to `main`:

- **`ci.yml` — Pull request checks:** format, lint, and docs-link checks on changed files; `pnpm test` and `pnpm run check-types` only for codemod packages touched by the diff.
- **`ci.yml` — Full workspace (main):** on every push to `main`, runs full `pnpm run ci` (all tests + typechecks) and `pnpm run docs:links`.
- **`ci.yml` — Changeset check:** enforces that every PR touching `codemods/` includes a changeset for each changed package (or has the `skip-changeset` label).

Match the local checks (`pnpm run ci`) before you push.

## Before you open a PR

- **Issue**: Check for an existing issue, or open one first.
- **Safety**: Codemods must be safe, predictable, and idempotent (running twice should not change code again). Avoid mixing patterns with different safety levels.
- **Naming**: In `codemod.yaml`, the codemod name must start with `@eslint`, where `eslint` is this repo's GitHub org.
- **Tests**: Add multiple fixtures (positive and negative).
- **Docs**: Update the README for your codemod.

## Making changes

1. Create a branch from `main`.
2. Make your changes and add or update fixtures under `tests/<case>/`.
3. Run `pnpm run format`, `pnpm run lint`, and `pnpm run ci` to verify everything passes.
4. Add a changeset for every codemod package you touched (see below).
5. Open a pull request.

## Adding a changeset

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and releases. **Every PR that changes a codemod package under `codemods/` should include a changeset**, unless you use the `skip-changeset` label (see CI). Details live in [`.changeset/README.md`](./.changeset/README.md).

```bash
pnpm changeset
```

Follow the prompts:

1. Select the affected codemod(s).
2. Choose the semver bump — **patch** for fixes, **minor** for new features, **major** for breaking changes.
3. Write a short summary.

Commit the new Markdown file under `.changeset/` with your PR.

`pnpm run version-packages` (run by automation on `main`, not usually by hand) runs `changeset version` and then [`scripts/sync-codemod-versions.sh`](./scripts/sync-codemod-versions.sh) so **`codemod.yaml` `version` stays aligned with `package.json`**. Do not edit `version` in `codemod.yaml` by hand — automation owns that field.

## Release workflow

Releases are fully automated via `.github/workflows/release.yml` on every push to `main`:

1. Merge a PR that includes one or more changesets into `main`.
2. The `release` job detects the pending changesets, runs `pnpm run version-packages` which:
   - bumps `version` in each affected `package.json` via `changeset version`
   - syncs the new version into the matching `codemod.yaml` via `scripts/sync-codemod-versions.sh`
3. The bot opens (or updates) a **Version Packages** pull request on branch `changeset-release/version-packages` — it does not push directly to `main`.
4. Merge that PR (EasyCLA and other required checks apply like any other PR).
5. On the next push to `main`, `scripts/tag-and-publish.sh` creates a `<name>@v<version>` git tag for every bumped package and pushes the tags.
6. The `publish` job fans out a parallel matrix over the changed directories and publishes each codemod via [`codemod/publish-action`](https://github.com/codemod/publish-action).

For emergencies (re-publish a specific codemod without a full release cycle), use the **Publish Codemod (Manual)** workflow (`.github/workflows/publish.yml`) and supply the tag, e.g. `@eslint/v8-to-v9-config@v1.2.0`.

Do not hand-edit `version` in `package.json` or `codemod.yaml` to simulate a release — automation owns bumps.

## Adding a new codemod

Scaffold a new codemod with the CLI:

```bash
npx codemod@latest init
```

New packages live under `codemods/`, for example:

```
codemods/v9/<slug>/
  scripts/codemod.ts   # JSSG transform
  tests/               # input / expected fixtures
  codemod.yaml         # manifest (version synced from package.json on release)
  workflow.yaml
  package.json
  tsconfig.json
  README.md
```

Conventions:

- The codemod name in `codemod.yaml` **and** `package.json` must start with `@eslint` (e.g. `@eslint/v8-to-v9-config`).
- Keep rewrites conservative. If a step requires a human decision, prefer a detector or recipe parameter over an unsafe transform.
- Use an existing sibling codemod in the same migration folder as a template.

Test your codemod locally against a sample project:

```bash
cd /path/to/sample/project
npx codemod workflow run -w /path/to/my-codemod/workflow.yaml
```

## Package shape

Each codemod package should include:

- `package.json` with at least `test` and `check-types` scripts.
- `codemod.yaml`, `workflow.yaml`, `tsconfig.json`, `README.md`
- `scripts/codemod.ts`
- `tests/<case>/input.*` and `tests/<case>/expected.*`

Keep transformations atomic and verifiable with fixtures.

## Checks

| Command                  | What it does                        |
| ------------------------ | ----------------------------------- |
| `pnpm run format`        | Auto-format with Biome              |
| `pnpm run format:check`  | Check formatting (no writes)        |
| `pnpm run lint`          | Lint with Biome                     |
| `pnpm run lint:fix`      | Lint and auto-fix with Biome        |
| `pnpm run test`          | Run all codemod tests               |
| `pnpm run check-types`   | Typecheck all codemod packages      |
| `pnpm run ci`            | Full check (test + typecheck)       |

## Pull requests

- Describe the codemod and its migration use case.
- Follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type       | Usage                                  |
| ---------- | -------------------------------------- |
| `feat`     | New codemod or capability              |
| `fix`      | Bugfix in a transform or test          |
| `docs`     | Documentation-only changes             |
| `refactor` | Non-feature, non-bugfix code changes   |
| `test`     | Add or update fixtures/tests           |
| `chore`    | Tooling, CI, formatting, repo hygiene  |

## License

By contributing, you agree that your work will be licensed under the MIT License.
