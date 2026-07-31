# @eslint/v8-to-v9-custom-rules

## 1.0.14

### Patch Changes

- 53c368b: exclude `node_modules` from workflow file scans

## 1.0.13

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

## 1.0.12

### Patch Changes

- f8f36f5: docs: update README for custom ESLint rules codemod migration to v9

## 1.0.11

### Patch Changes

- 9879eef: fix: update custom-rules workflow globs to include TypeScript module extensions and exclude declaration files.

## 1.0.10

### Patch Changes

- 0ef9726: Fix incorrect CLI command in README (`npx codemod@latest run` → `npx codemod@latest`) and add missing deprecated `context` method mappings to the migration reference table.
