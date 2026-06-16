---
'@eslint/v8-to-v9-config': patch
'@eslint/v8-to-v9-custom-rules': patch
---

Expand ESLint v8→v9 migration coverage for blog items previously marked manual-only.

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
