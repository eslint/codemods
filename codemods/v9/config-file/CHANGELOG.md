# @eslint/v8-to-v9-config

## 1.9.40

### Patch Changes

- 75a5fef: Expand ESLint v8→v9 migration coverage for blog items previously marked manual-only.

  **@eslint/v8-to-v9-config**
  - Preserve v8 rule behavior for `no-invalid-regexp`, `no-implicit-coercion`, `no-inner-declarations`, and `no-unused-vars` catch ignore patterns
  - Disable new `eslint:recommended` rules added in v9 when extending the preset
  - Keep the first duplicate `/* eslint */` rule comment (v9 applies the first, not the last)
  - Migrate `package.json` ESLint scripts: replace removed CLI formatters and add `.` to bare `eslint` scripts
  - Convert legacy `"eslint:recommended"` / `"eslint:all"` string presets in existing flat configs to `@eslint/js`

  **@eslint/v8-to-v9-custom-rules**
  - Replace `sourceCode.getComments()` outside rule `context` usage
  - Migrate `FlatRuleTester` → `RuleTester`, `parserOptions` → `languageOptions`, and duplicate `output`/`code` test cases
  - Migrate `FlatESLint` → `ESLint` and `Linter#verify` config to flat `languageOptions`

## 1.9.39

### Patch Changes

- 707a35d: Trim leading and trailing whitespace from `.eslintignore` and `.gitignore` lines before merging them into `globalIgnores`, preventing stray spaces from breaking ignore patterns. Also fix the misspelled `transform-eslintrc-yaml-no-globals-for-env` test directory name so it runs under the `transform-eslintrc` filter.

## 1.9.38

### Patch Changes

- 1624069: Recognize single-quoted and `node:`-prefixed builtin module specifiers when adding `__dirname` helper imports, preventing duplicate `url`/`path` helper imports when configs already import from `node:url` or `node:path`.

## 1.9.37

### Patch Changes

- bddc18a: fix: handle CRLF line endings in ignore files
