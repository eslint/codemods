# @eslint/v9-to-v10-config

Remove `eslint-env` inline comments and legacy env vars and CLI flags for ESLint v10.

## Overview

ESLint v10 removes several configuration mechanisms that were deprecated in v9.

## What This Codemod Does

### Transform 1 — Remove `eslint-env` inline comments

`eslint-env` comments are now a lint error in ESLint v10. This transform removes them entirely.

```js
// Before
/* eslint-env browser */
const el = document.getElementById('app')

/* eslint-env node, browser */
function read() {
  return process.env.NODE_ENV
}

// After
const el = document.getElementById('app')

function read() {
  return process.env.NODE_ENV
}
```

### Transform 2 — Remove legacy env vars and CLI flags

`ESLINT_USE_FLAT_CONFIG` and several `ESLINT_FLAGS` values are removed in v10. Legacy CLI flags are also removed.

| Before                                               | After      |
| ---------------------------------------------------- | ---------- |
| `ESLINT_USE_FLAT_CONFIG=true eslint .`               | `eslint .` |
| `ESLINT_USE_FLAT_CONFIG=false eslint .`              | `eslint .` |
| `v10_config_lookup_from_file` in `ESLINT_FLAGS`      | Removed    |
| `unstable_config_lookup_from_file` in `ESLINT_FLAGS` | Removed    |
| `unstable_ts_config` in `ESLINT_FLAGS`               | Removed    |
| `--no-eslintrc`                                      | Removed    |
| `--env`                                              | Removed    |
| `--rulesdir`                                         | Removed    |
| `--ignore-path`                                      | Removed    |
| `--resolve-plugins-relative-to`                      | Removed    |

## Usage

```bash
npx codemod @eslint/v9-to-v10-config
```

Or with the workflow runner:

```bash
npx codemod workflow run -w codemods/v10/config/workflow.yaml
```

## Resources

- [ESLint v10 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
