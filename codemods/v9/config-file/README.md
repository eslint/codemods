# @eslint/v8-to-v9-config

Automatically migrate your ESLint configuration from v8 to v9 flat config format.

## Overview

This codemod provides a comprehensive migration solution for ESLint v8 to v9:

- **Config Migration**: Converts `.eslintrc.*` files to the new flat config format
- **Breaking Changes**: Handles all v9 breaking changes in rules and options
- **JSDoc Migration**: Migrates deprecated JSDoc rules to `eslint-plugin-jsdoc`
- **Comment Cleanup**: Fixes malformed comments and removes deprecated syntax

## What This Codemod Does

This codemod performs a comprehensive migration from ESLint v8 to v9. It handles the following breaking changes from the [official ESLint v9 migration guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0):

- ✅ **New default config format (`eslint.config.js`)**
- ✅ **Removed `require-jsdoc` and `valid-jsdoc` rules** - migrates to `eslint-plugin-jsdoc`
- ✅ **Multiple `/* eslint */` comments for the same rule are now disallowed** - removes duplicates
- ✅ **Stricter `/* exported */` parsing** - fixes malformed comments
- ✅ **`no-constructor-return` and `no-sequences` rule schemas are stricter** - updates to new format
- ✅ **`no-restricted-imports` now accepts multiple config entries with the same `name`** - deduplicates paths
- ✅ **`"eslint:recommended"` and `"eslint:all"` no longer accepted in flat config** - converts to `js.configs.*`
- ✅ **`no-unused-vars` now defaults `caughtErrors` to `"all"`** - adds backward-compatible default
- ✅ **`no-useless-computed-key` flags unnecessary computed member names in classes by default** - adds `enforceForClassMembers: false`
- ✅ **`camelcase` allow option only accepts an array of strings** - validates and migrates options
- ✅ **`Linter` now expects flat config format** - generates flat config files

### Detailed Transformations:

### 1. Configuration File Migration

- **Converts** `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yaml`, and `.eslintrc.yml` to the new flat config format (`eslint.config.cjs`)
- **Transforms** `extends` configurations (e.g., `"eslint:recommended"` → `js.configs.recommended`)
- **Migrates** `env` settings to the new `languageOptions.globals` format
- **Updates** `globals` and `parserOptions` to the flat config structure
- **Preserves** `overrides` by converting them to separate configuration objects
- **Adds** necessary imports (`@eslint/js`, `globals`, etc.)

### 2. Rule Transformations

Automatically updates several ESLint rules with breaking changes:

- **`no-unused-vars`**: Adds default `caughtErrors: 'none'` option
- **`no-useless-computed-key`**: Adds `enforceForClassMembers: false` option
- **`no-sequences`**: Properly migrates `allowInParentheses` option
- **`no-constructor-return`**: Ensures proper array format
- **`camelcase`**: Migrates options while handling complex `allow` patterns
- **`no-restricted-imports`**: Restructures paths configuration

### 3. JSDoc Migration

- **Detects** `require-jsdoc` and `valid-jsdoc` rules (removed in ESLint v9)
- **Migrates** to `eslint-plugin-jsdoc` with appropriate configuration
- **Removes** deprecated JSDoc-related eslint comments

### 4. Comment Cleanup

- **Removes** unnecessary eslint comments from files
- **Fixes** malformed `/* exported */` comments to proper format

## Usage

Simply run the codemod in your project directory. It will automatically find and migrate all `.eslintrc.*` files:

```bash
npx codemod@latest run @eslint/v8-to-v9-config

# Or run locally
npx codemod@latest workflow run -w workflow.yaml
```

## ⚠️ Important Warnings

This codemod automatically migrates your ESLint configuration from v8 to v9 config format.

It also supports migration for the following popular plugins and presets:

| Plugin/Config        | Migration Support                             |
| -------------------- | --------------------------------------------- |
| `eslint:recommended` | ✅ Fully migrated to `js.configs.recommended` |
| `eslint:all`         | ✅ Fully migrated to `js.configs.all`         |
| `prettier`           | ✅ Fully migrated                             |
| `@angular-eslint/*`  | ✅ Fully migrated                             |
| `ember`              | ✅ Fully migrated                             |

### ⚠️ Unsupported Plugins, Extends, and Custom Rules

For **custom rules** and **`extends` entries from plugins not listed above**, this codemod will:

1. **Comment out** unsupported plugins and extends
2. **Add the following TODO comments** to explain the required manual follow-up
3. **Keep the rest of the migration safe** to merge and easy to test

```js
// TODO: Custom rule migrations for v9 are handled by a separate codemod: @eslint/v8-to-v9-custom-rules
// TODO: For unsupported plugins or extends, check whether the plugin author has released ESLint v9 support and follow their migration guide once it's available.
```

## Manual Steps Required

After running this codemod, you may need to:

1. **Install new dependencies**:

```bash
npm install --save-dev eslint@9 @eslint/js globals
# If using JSDoc rules:
npm install --save-dev eslint-plugin-jsdoc
```

2. **Remove `.eslintignore` files**:

> ⚠️ **Warning**: This codemod attempts to remove `.eslintignore` files, but it may fail due to permission issues. Please manually check and remove these files if needed by running:
>
> ```bash
> rm **/.eslintignore
> ```
>
> Note: In ESLint v9 flat config, ignore patterns are specified in the config file itself using `ignores` property, so `.eslintignore` files are no longer needed.

3. **Update JSDoc settings** manually if needed (marked with `// TODO: Migrate settings manually`)

4. **Test your ESLint configuration**:

```bash
npx eslint .
```

## What Gets Transformed

### Before (`.eslintrc.json`)

```json
{
  "extends": ["eslint:recommended"],
  "env": {
    "node": true,
    "es2021": true
  },
  "rules": {
    "no-unused-vars": "error",
    "require-jsdoc": [
      "error",
      {
        "require": {
          "FunctionDeclaration": true
        }
      }
    ]
  }
}
```

### After (`eslint.config.mjs`)

```javascript
import { jsdoc } from "eslint-plugin-jsdoc";
import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "@eslint/config-helpers";

const cleanGlobals = (globalsObj) => {
  return Object.fromEntries(Object.entries(globalsObj).map(([key, value]) => [key.trim(), value]));
};

export default defineConfig([
  jsdoc({
    config: "flat/recommended",
    settings: {
      // TODO: Migrate settings manually
      FunctionDeclaration: true,
    },
  }),
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...cleanGlobals(globals.node),
        ...cleanGlobals(globals.es2021),
      },
      parserOptions: {},
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
]);
```

## Resources

### Official ESLint Documentation

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
