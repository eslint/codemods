# Changesets

This directory contains changesets — short Markdown files that describe changes to packages in this repo.

When you run `pnpm changeset`, a new file is created here. Commit it with your PR.

When a PR is merged to `main`, the `release.yml` workflow consumes these files, bumps the relevant `package.json` and `codemod.yaml` versions, and opens a **Version Packages** PR. After that PR is merged, the workflow creates git tags and publishes the affected codemods.

See [Changesets docs](https://github.com/changesets/changesets) for more detail.
