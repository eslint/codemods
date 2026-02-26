# @eslint/v8-to-v9-config

Migrate ESLint v8 to v9 format automatically.

## Quick Start

```bash
npx codemod@latest run @eslint/v8-to-v9-config

# Or run locally
npx codemod@latest workflow run -w workflow.yaml

# For projects with multiple configs, use --target to specify the directory:
npx codemod@latest run @eslint/v8-to-v9-config -t /path/to/project
```

After running, the codemod will display a list of packages that need to be installed. Install them:

```bash
npm install --save-dev eslint@9 @eslint/js globals @eslint/eslintrc
```

> **Note**: If your config uses `extends`, you'll also need `@eslint/eslintrc` for FlatCompat support.
> ⚠️ **Important**: The codemod will display a yellow note reminding you to verify that all packages are not deprecated and still supported for ESLint v9. Please check each package before installing.

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

**All extends and plugins are preserved exactly as they were** - no additions or removals.

#### Extends Migration

The codemod uses `FlatCompat` from `@eslint/eslintrc` to migrate extends to the flat config format:

- **`eslint:recommended` and `eslint:all`**: These are automatically detected and handled with special FlatCompat instances that include `recommendedConfig` and/or `allConfig` properties
- **All other extends**: Preserved exactly as they were and converted using `compat.extends()` method
- **`eslint:recommended` and `eslint:all` are filtered out** from the extends array since they're handled by the FlatCompat configuration

**Example:**

If your original config had:

```json
{
  "extends": ["eslint:recommended", "plugin:react/recommended", "airbnb"]
}
```

The migrated config will be:

```javascript
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compatWithRecommended = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default defineConfig([
  {
    extends: compatWithRecommended.extends(["plugin:react/recommended", "airbnb"]),
    // ... other config
  },
]);
```

Note that `eslint:recommended` is handled by the `recommendedConfig` in FlatCompat, so it's filtered out from the extends array.

**Required dependency:**

```bash
npm install --save-dev @eslint/eslintrc
```

#### Plugin Migration

**All plugins are preserved exactly as they were** - the codemod extracts them from the original config and maintains their exact format, including:

- Plugin names
- Plugin values (imports, require calls, etc.)
- Plugin structure (object or array format)

The codemod automatically adds import statements for plugins when they're detected in the original config.

**Plugin Naming Conventions:**

The codemod follows ESLint v9 conventions for plugin package names and import identifiers:

- **Unscoped packages**: `eslint-plugin-foo` → imports as `fooPlugin` from `"eslint-plugin-foo"`
- **Scoped packages**: `@foo/eslint-plugin` → imports as `fooPlugin` from `"@foo/eslint-plugin"`
- **Scoped packages with suffix**: `@foo/eslint-plugin-bar` → imports as `fooBarPlugin` from `"@foo/eslint-plugin-bar"`

The import identifiers are automatically generated to be valid JavaScript identifiers, converting package names to camelCase format.

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
import path from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import globals from "globals";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig } from "@eslint/config-helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compatWithRecommended = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default defineConfig([
  {
    extends: compatWithRecommended.extends([]),
    languageOptions: {
      globals: {
        myCustomGlobal: "readonly",
        jQuery: "readonly",
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-unused-vars": ["error", { caughtErrors: "all", vars: "all", args: "after-used" }],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: ["error", { properties: "always", ignoreDestructuring: false }],
    },
  },
  {
    files: ["*.test.js", "*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
      parserOptions: {},
    },
    rules: {
      "no-console": "off",
    },
  },
]);
```

> **Note**: If your config has other extends (e.g., `"plugin:react/recommended"`), they will be included in the `compat.extends()` array, while `eslint:recommended` and `eslint:all` are automatically handled by the FlatCompat configuration.

## Resources

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
