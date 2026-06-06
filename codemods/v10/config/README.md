# @eslint/v9-to-v10-config

Remove legacy env vars and CLI flags for ESLint v10.

## Overview

ESLint v10 removes several configuration mechanisms that were deprecated in v9.

## What This Codemod Does

### Transform — Remove legacy env vars and CLI flags

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

## Manual step required — `eslint-env` inline comments

ESLint v10 reports `/* eslint-env */` comments as lint errors. This codemod does **not** remove them automatically because these comments also declare globals (e.g. `/* eslint-env browser */` provides `window`, `document`, etc.). Removing them without migrating the globals would silently break rules like `no-unused-vars`.

After running this codemod, fix `eslint-env` comments manually:

1. Remove the `/* eslint-env ... */` comment from the source file.
2. Add the corresponding globals to `eslint.config.js`:

```js
// eslint.config.js
import globals from 'globals'

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser, // replaces /* eslint-env browser */
        ...globals.node, // replaces /* eslint-env node */
      },
    },
  },
]
```

See the [globals package](https://www.npmjs.com/package/globals) for the full list of available environments.

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
