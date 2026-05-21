# @eslint/v8-to-v9-config

Migrate ESLint v8 to v9 format automatically.

## Quick Start

```bash
npx codemod run @eslint/v8-to-v9-config

# Or run locally
npx codemod workflow run -w workflow.yaml

# For projects with multiple configs, use --target to specify the directory:
npx codemod run @eslint/v8-to-v9-config -t /path/to/project
```

### Workflow Params

When running [`workflow.yaml`](workflow.yaml) directly:

**Formatting**

- `codeFormattingCommandEnabled` (boolean, default: `false`): Enables/disables the formatting step.
- `codeFormattingCommand` (string, default: `npx prettier --write "**/eslint.config.mjs" --ignore-path /dev/null --no-config --no-error-on-unmatched-pattern`): Command to run when formatting is enabled.

**Config discovery**

By default the workflow scans the usual ESLint filenames (`.eslintrc.{js,mjs,cjs,json,yaml,yml}`). Optional params add an extra ast-grep pass for a differently named legacy config whose path ends with your custom fragment:

- `eslintConfigCustomName` (string, default: unset / `null`): Fragment matched as `**/*<value>` (for example `.eslintrc.local.json` matches any file ending in that suffix). Leave unset unless you rely on a non-standard config filename.
- `eslintConfigLanguage` (string, default: `javascript`): ast-grep language for that file — use `javascript` for `.js` / `.mjs` / `.cjs`, `json` for `.json`, or `yaml` for `.yaml` / `.yml`. Must align with how the fragment is parsed.

Example (formatting + custom config fragment):

```bash
npx codemod workflow run -w workflow.yaml \
  -p codeFormattingCommandEnabled=true \
  -p 'codeFormattingCommand=npx prettier --write "**/eslint.config.mjs" --ignore-path /dev/null --no-config --no-error-on-unmatched-pattern'
```

Example (custom-named legacy JSON config):

```bash
npx codemod workflow run -w workflow.yaml \
  -p eslintConfigCustomName=my-eslint-rules.json \
  -p eslintConfigLanguage=json
```

After running, the codemod will display a list of packages that need to be installed. Install them:

```bash
npm install --save-dev eslint@9 @eslint/js globals @eslint/eslintrc @eslint/config-helpers @eslint/compat
```

> **Note**: If your config uses `extends` or plugins, keep `@eslint/eslintrc` (FlatCompat) and `@eslint/compat` (`fixupConfigRules` / `fixupPluginRules`).
> ⚠️ **Important**: The codemod will display a yellow note reminding you to verify that all packages are not deprecated and still supported for ESLint v9. Please check each package before installing.

Then test your config:

```bash
npx eslint .
```

## Migration Steps

### Step 1: Config File Conversion

Converts `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, optional custom-named configs (via workflow params), and in-repo `package.json` `eslintConfig`, to flat config (`eslint.config.mjs`).

**What gets migrated:**

- `env` settings → `languageOptions.globals` (including per-override `env`)
- `globals` → `languageOptions.globals`
- `parserOptions` → `languageOptions.parserOptions`
- **`files`** (root or overrides) → `files` on the corresponding flat config object
- **`excludedFiles`** (typically on overrides) → `ignores` on that **same** object (patterns that apply alongside `files`)
- **`ignorePatterns`** (root or per-sector) plus patterns from scanned ignore-list files → merged into a leading **`globalIgnores([...])`** entry (global ignores shared across configs)
- `overrides` → separate configuration objects in the array (each keeps its own `files` / `ignores` where present)
- `linterOptions` for supported settings: **`noInlineConfig`** and **`reportUnusedDisableDirectives`** are collected into **`linterOptions`** on each flat block where they appeared (boolean `true` / `false` for `reportUnusedDisableDirectives` map to **`"warn"`** / **`"off"`**; explicit severity strings are preserved)

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

The codemod uses `FlatCompat` from `@eslint/eslintrc` so legacy `extends` become `fixupConfigRules(<compat>.extends(/* original strings preserved */))` in flat config:

- When **`eslint:recommended`** appears, a `FlatCompat` is created with `recommendedConfig: js.configs.recommended`
- When **`eslint:all`** appears, a `FlatCompat` is created with `allConfig: js.configs.all`
- When **both** appear, a combined compat instance wires both presets
- **Any other presets** reuse a plain `FlatCompat({ baseDirectory: __dirname })` or the recommended/all instance above, depending on overlap

All `extends` string values from the legacy config are passed through unchanged to `.extends(...)`.

**Example:**

If your original config had:

```json
{
  "extends": ["eslint:recommended", "plugin:react/recommended", "airbnb"]
}
```

The migrated config will resemble:

```javascript
import path from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import { defineConfig } from '@eslint/config-helpers'
import { fixupConfigRules } from '@eslint/compat'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compatWithRecommended = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

export default defineConfig([
  {
    extends: fixupConfigRules(
      compatWithRecommended.extends('eslint:recommended', 'plugin:react/recommended', 'airbnb'),
    ),
    // ... other config
  },
])
```

`recommendedConfig` / `allConfig` wire the bundled ESLint presets; the same strings usually remain in `.extends(...)` so shared configs load as before.

**Required dependencies:**

```bash
npm install --save-dev @eslint/eslintrc @eslint/config-helpers @eslint/compat
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

### Step 6: Global ignores (`ignorePatterns`, ignore-list files)

In flat config, global path ignores are expressed with `globalIgnores` from `@eslint/config-helpers` (the codemod emits a leading `globalIgnores([...])` object when needed).

**Sources merged into `globalIgnores`:**

- Legacy **`ignorePatterns`** from the ESLint config (root or applicable blocks), and
- Non-comment lines from **`.eslintignore`** and **`.gitignore`** files found by the workflow’s ignore scan (same line-based rules; paths are de-duplicated with config `ignorePatterns`).

**Per-override `excludedFiles`** are **not** global: they become **`ignores`** on the same flat object as that block’s **`files`** (see Step 1).

The workflow renames processed ignore-list files to `deleted-eslintignore-backup.txt` (relative path) to avoid leaving active ignore files behind; if that fails (permissions, etc.), remove or reconcile them manually.

> ⚠️ **Manual step**: If any backup or legacy ignore file remains, delete or merge it after verifying `globalIgnores` in `eslint.config.mjs`.
>
> ```bash
> rm **/.eslintignore
> ```

**Before** (`.eslintrc.json`):

```json
{
  "ignorePatterns": ["coverage/**", "dist"],
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": ["eslint:recommended"],
  "noInlineConfig": true,
  "reportUnusedDisableDirectives": true,
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
      "excludedFiles": ["*.fixture.js"],
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
import path from 'path'
import { fileURLToPath } from 'url'
import js from '@eslint/js'
import globals from 'globals'
import { FlatCompat } from '@eslint/eslintrc'
import { defineConfig, globalIgnores } from '@eslint/config-helpers'
import { fixupConfigRules } from '@eslint/compat'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compatWithRecommended = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

export default defineConfig([
  globalIgnores(['coverage/**', 'dist']),
  {
    extends: fixupConfigRules(compatWithRecommended.extends('eslint:recommended')),
    languageOptions: {
      globals: {
        myCustomGlobal: 'readonly',
        jQuery: 'readonly',
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-sequences': ['error', { allowInParentheses: false }],
      'no-unused-vars': ['error', { caughtErrors: 'all', vars: 'all', args: 'after-used' }],
      'no-useless-computed-key': ['error', { enforceForClassMembers: true }],
      camelcase: ['error', { properties: 'always', ignoreDestructuring: false }],
    },
  },
  {
    files: ['*.test.js', '*.spec.js'],
    ignores: ['*.fixture.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
      parserOptions: {},
    },
    rules: {
      'no-console': 'off',
    },
  },
])
```

> **Note**: Additional `extends` (for example `"plugin:react/recommended"`) remain string entries inside `fixupConfigRules(compatWithRecommended.extends(/* ... */))`. `eslint:recommended` / `eslint:all` continue to use the dedicated `FlatCompat` instances wired to `js.configs.recommended` / `js.configs.all`.

## Resources

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)
