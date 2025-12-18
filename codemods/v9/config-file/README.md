# @eslint/v8-to-v9-config

Migrate ESLint v8 to v9 format automatically.

## Quick Start

```bash
npx codemod@latest run @eslint/v8-to-v9-config

# Or run locally
npx codemod@latest workflow run -w workflow.yaml
```

After running, install dependencies:

```bash
npm install --save-dev eslint@9 @eslint/js globals
```

Then test your config:

```bash
npx eslint .
```

## Migration Steps

### Step 1: Config File Conversion

Converts `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yaml`, and `.eslintrc.yml` to the new config format (`eslint.config.mjs`).

**What gets migrated:**

- `env` settings → `languageOptions.globals`
- `globals` → `languageOptions.globals`
- `parserOptions` → `languageOptions.parserOptions`
- `overrides` → separate configuration objects in the array

### Step 2: Rule Schema Updates

Updates rules with breaking schema changes in ESLint v9:

| Rule                      | Migration                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| `no-unused-vars`          | Adds `caughtErrors: 'none'` (v9 changed default to `'all'`)         |
| `no-useless-computed-key` | Adds `enforceForClassMembers: false` (v9 changed default to `true`) |
| `no-sequences`            | Migrates `allowInParentheses` to new format                         |
| `no-constructor-return`   | Ensures proper array format                                         |
| `camelcase`               | Validates `allow` option (must be array of strings)                 |
| `no-restricted-imports`   | Restructures paths configuration                                    |

### Step 3: JSDoc Rules Migration

The `require-jsdoc` and `valid-jsdoc` rules were removed in ESLint v9. This codemod migrates them to `eslint-plugin-jsdoc`.

**After running, install the plugin:**

```bash
npm install --save-dev eslint-plugin-jsdoc
```

> ⚠️ **Manual step**: If you have custom JSDoc settings, look for `// TODO: Migrate settings manually` comments in your config and update them accordingly.

### Step 4: Comment Cleanup

Fixes ESLint comment syntax that became invalid in v9:

- **Duplicate `/* eslint */` comments**: Removes duplicate rule comments for the same rule
- **Malformed `/* exported */` comments**: Fixes to proper format

### Step 5: Extends & Plugin Migration

**Supported presets (fully migrated):**

| Config/Plugin        | Migration                  |
| -------------------- | -------------------------- |
| `eslint:recommended` | → `js.configs.recommended` |
| `eslint:all`         | → `js.configs.all`         |
| `prettier`           | ✅ Fully migrated          |
| `@angular-eslint/*`  | ✅ Fully migrated          |
| `ember`              | ✅ Fully migrated          |

> ⚠️ **Unsupported plugins and extends**: For plugins not listed above, this codemod will:
>
> 1. Comment out the unsupported extends/plugins
> 2. Add TODO comments explaining the required manual follow-up:
>
> ```js
> // TODO: For unsupported plugins or extends, check whether the plugin author
> // has released ESLint v9 support and follow their migration guide.
> ```
>
> Check the plugin's documentation for v9 migration instructions.

### Step 6: Ignore File Migration

ESLint v9 uses the `ignores` property instead of `.eslintignore` files.

This codemod attempts to migrate `.eslintignore` content to the config file's `ignores` array.

> ⚠️ **Manual step**: The codemod attempts to delete `.eslintignore` files, but may fail due to permissions. After running, verify and remove manually if needed:
>
> ```bash
> rm **/.eslintignore
> ```

**Before** (`.eslintrc.json`):

```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "globals": {
    "myCustomGlobal": "readonly",
    "jQuery": "readonly"
  },
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-unused-vars": [
      "error",
      {
        "vars": "all",
        "args": "after-used",
        "caughtErrors": "all"
      }
    ],
    "no-sequences": [
      "error",
      {
        "allowInParentheses": false
      }
    ],
    "camelcase": [
      "error",
      {
        "properties": "always",
        "ignoreDestructuring": false
      }
    ],
    "no-useless-computed-key": [
      "error",
      {
        "enforceForClassMembers": true
      }
    ]
  },
  "overrides": [
    {
      "files": ["*.test.js", "*.spec.js"],
      "env": {
        "jest": true
      },
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

**After** (`eslint.config.mjs`):

```javascript
import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "@eslint/config-helpers";

const cleanGlobals = (globalsObj) => {
  if (!globalsObj) return {};
  return Object.fromEntries(Object.entries(globalsObj).map(([key, value]) => [key.trim(), value]));
};

export default defineConfig([
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        myCustomGlobal: "readonly",
        jQuery: "readonly",
        ...cleanGlobals(globals.browser),
        ...cleanGlobals(globals.es2021),
        ...cleanGlobals(globals.node),
      },
      parserOptions: {
        ecmaVersion: "latest",
      },
      sourceType: "module",
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-unused-vars": ["error", { caughtErrors: '"all"', vars: '"all"', args: '"after-used"' }],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: ["error", { properties: '"always"', ignoreDestructuring: false }],
    },
  },
  {
    files: ["*.test.js", "*.spec.js"],
    languageOptions: {
      globals: {
        ...cleanGlobals(globals.jest),
      },
      parserOptions: {},
    },
    rules: {
      "no-console": "off",
    },
  },
]);
```

## Resources

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
