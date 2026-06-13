# @eslint/v9-to-v10

Migrate ESLint projects from v9 to v10 in a single command. This recipe runs all four v9-to-v10 codemods in sequence.

## Usage

```bash
npx codemod @eslint/v9-to-v10
```

## What This Recipe Does

This recipe combines the following four codemods into one workflow:

| Codemod                                                       | What it handles                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`@eslint/v9-to-v10-config`](../config/README.md)             | Remove legacy env vars (`ESLINT_USE_FLAT_CONFIG`) and deprecated CLI flags from shell scripts, `package.json` scripts, and CI/CD YAML |
| [`@eslint/v9-to-v10-custom-rules`](../custom-rules/README.md) | Migrate deprecated `context` methods and `SourceCode` methods in custom rule implementations                                          |
| [`@eslint/v9-to-v10-ruletester`](../ruletester/README.md)     | Remove properties from `RuleTester` test cases that ESLint v10 now rejects                                                            |
| [`@eslint/v9-to-v10-linter-api`](../linter-api/README.md)     | Fix removed `Linter`/`ESLint` constructor options, deprecated instance methods, and stricter built-in rule schemas                    |

### Steps (in order)

| #   | Step                        | Transform                                                                                                                                                          |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Remove legacy flags (JS/TS) | `ESLINT_USE_FLAT_CONFIG`, `ESLINT_FLAGS` values, `--no-eslintrc`, `--env`, `--rulesdir`, `--ignore-path`, `--resolve-plugins-relative-to` from child_process calls |
| 2   | Remove legacy flags (JSON)  | Same removals in `package.json` `scripts` values                                                                                                                   |
| 3   | Remove legacy flags (YAML)  | Same removals in CI `run:` steps                                                                                                                                   |
| 4   | Replace context methods     | `context.getFilename()` → `context.filename`, `getCwd()` → `cwd`, etc.; `parserOptions` → `languageOptions.parserOptions`                                          |
| 5   | Replace SourceCode methods  | `getTokenOrCommentBefore/After()` → `getTokenBefore/After({ includeComments: true })`; `isSpaceBetweenTokens()` → `isSpaceBetween()`                               |
| 6   | Clean up valid test cases   | Remove `errors` and `output` from `valid` cases in `ruleTester.run()`                                                                                              |
| 7   | Clean up invalid test cases | Remove `type` from error objects in `invalid` cases in `ruleTester.run()`                                                                                          |
| 8   | Fix Linter constructor      | Remove `configType`, `useFlatConfig`; strip deprecated flag values; flag deprecated methods                                                                        |
| 9   | Fix rule options            | `func-names` 4th element, `no-invalid-regexp` duplicate flags, `radix` deprecated string options                                                                   |
| 10  | Fix LintMessage             | Remove `nodeType` property from LintMessage objects; flag `.nodeType` member accesses                                                                              |

## After Running

Search for `TODO` comments added by this recipe and address them manually:

| TODO comment                               | Action required                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `configType "eslintrc" is removed`         | Rewrite the integration to use flat config (`eslint.config.js`)           |
| `defineParser() removed in ESLint v10`     | Register parsers in `eslint.config.js` `languageOptions.parser`           |
| `defineRule() removed in ESLint v10`       | Register rules in `eslint.config.js` `plugins`                            |
| `defineRules() removed in ESLint v10`      | Register rules in `eslint.config.js` `plugins`                            |
| `getRules() removed in ESLint v10`         | Use `ESLint.getRulesMetaForResults()` instead                             |
| `LintMessage.nodeType was removed`         | Remove the surrounding expression that reads `.nodeType`                  |
| `context.parserPath removed in ESLint v10` | Use `context.languageOptions.parser` (object, not path string)            |
| `getJSDocComment removed in ESLint v10`    | Use `sourceCode.getCommentsBefore(node)` with a third-party JSDoc library |
| `"as-needed" is removed in ESLint v10`     | Remove `"as-needed"` from the `radix` config or disable the rule          |

## Limitations

The following cases require manual attention and are not auto-transformed:

- **`/* eslint-env */` comments** — not removed; add the corresponding globals to `eslint.config.js` using the [`globals`](https://www.npmjs.com/package/globals) package
- **Template strings with interpolations** in `execSync`/`exec` calls — skipped; inspect and update manually
- **`loadESLint({ useFlatConfig, ...extras })`** — not transformed when extra options are present alongside `useFlatConfig`
- **Aliased ESLint imports** (`import { Linter as L } from 'eslint'`) — linter-api transforms are not applied to renamed bindings
- **`func-names` with nested options objects** — only flat option objects are matched
- **`radix: ['error', 'always', ...]`** — `'always'` is only stripped when it is the sole option in the array

## Resources

- [ESLint v10 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
