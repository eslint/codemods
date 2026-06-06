# @eslint/v9-to-v10-linter-api

Migrate removed `Linter`/`ESLint` constructor options and stricter rule config schema for ESLint v10.

## Overview

ESLint v10 removes the `configType` option, the `useFlatConfig` option on `loadESLint`, several `Linter` instance methods, and tightens the schema for three built-in rules.

## What This Codemod Does

### Transform 1 — Remove `configType` from `new Linter()`

`configType: 'flat'` is the only supported mode in v10 and no longer needs to be specified. `configType: 'eslintrc'` is removed with no equivalent — a TODO comment is inserted.

```js
// Before
const linter = new Linter({ configType: 'flat' })
const linter2 = new Linter({ configType: 'flat', allowInlineConfig: true })
const legacy = new Linter({ configType: 'eslintrc' })

// After
const linter = new Linter()
const linter2 = new Linter({ allowInlineConfig: true })
const legacy =
  new Linter(/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */)
```

### Transform 2 — Remove `useFlatConfig` from `loadESLint()`

```js
// Before
const ESLintClass = await loadESLint({ useFlatConfig: true })

// After
const ESLintClass = await loadESLint()
```

### Transform 3 — Remove deprecated flag values from `new ESLint({ flags: [...] })`

```js
// Before
const eslint = new ESLint({ flags: ['v10_config_lookup_from_file'] })

// After
const eslint = new ESLint({ flags: [] })
```

### Transform 4 — Deprecated `Linter` instance methods → TODO

`defineParser()`, `defineRule()`, `defineRules()`, and `getRules()` are removed with no direct replacement. Register rules and parsers via the flat config instead.

```js
// Before
linter.defineParser('babel-eslint', require('babel-eslint'))
linter.defineRule('my-rule', myRule)

// After
linter.defineParser(
  /* TODO: defineParser() removed in ESLint v10, no replacement */ 'babel-eslint',
  require('babel-eslint'),
)
linter.defineRule(/* TODO: defineRule() removed in ESLint v10, no replacement */ 'my-rule', myRule)
```

### Transform 5 — `func-names` stricter schema (remove extra 4th element)

```js
// Before
'func-names': ['error', 'always', {}, 'as-needed']

// After
'func-names': ['error', 'always', {}]
```

### Transform 6 — `no-invalid-regexp` deduplicate `allowConstructorFlags`

```js
// Before
'no-invalid-regexp': ['error', { allowConstructorFlags: ['u', 'y', 'u'] }]

// After
'no-invalid-regexp': ['error', { allowConstructorFlags: ['u', 'y'] }]
```

### Transform 7 — `radix` deprecated string options

The `"always"` and `"as-needed"` string options of the `radix` rule are deprecated in ESLint v10. The rule now always enforces providing a radix argument. `"always"` is stripped (it is now the sole behavior). `"as-needed"` is flagged with a TODO because removing it changes the rule's behavior.

```js
// Before
'radix': ['error', 'always']
'radix': ['error', 'as-needed']

// After
'radix': 'error'
'radix': ['error', /* TODO: radix "as-needed" option is deprecated in ESLint v10 — the rule now always enforces providing the radix argument */ 'as-needed']
```

### Transform 8 — Remove `LintMessage.nodeType`

`LintMessage.nodeType` was removed in ESLint v10. Two patterns are handled:

**Object property pairs** — `nodeType: <value>` is removed from object literals (common in test assertions):

```js
// Before
assert.deepEqual(messages[0], {
  ruleId: 'no-var',
  severity: 2,
  message: 'Unexpected var, use let or const instead.',
  nodeType: 'VariableDeclaration',
})

// After
assert.deepEqual(messages[0], {
  ruleId: 'no-var',
  severity: 2,
  message: 'Unexpected var, use let or const instead.',
})
```

**Member expression accesses** — `.nodeType` in formatters and custom tooling is flagged with a TODO (the surrounding expression must be removed manually):

```js
// Before
const type = message.nodeType

// After
const type = message.nodeType /* TODO: LintMessage.nodeType was removed in ESLint v10 — remove this usage */
```

## Usage

```bash
npx codemod @eslint/v9-to-v10-linter-api
```

## After running

Search for `TODO` comments added by this codemod:

| TODO comment                           | Action required                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `configType "eslintrc" is removed`     | Rewrite integration to use flat config (`eslint.config.js`)                                 |
| `defineParser() removed in ESLint v10` | Register parsers in `eslint.config.js` `languageOptions.parser`                             |
| `defineRule() removed in ESLint v10`   | Register rules in `eslint.config.js` `plugins`                                              |
| `defineRules() removed in ESLint v10`  | Register rules in `eslint.config.js` `plugins`                                              |
| `getRules() removed in ESLint v10`     | Use `ESLint.getRulesMetaForResults()` or `Linter.getRules()` was removed with no equivalent |
| `LintMessage.nodeType was removed`     | Remove the surrounding expression that reads `message.nodeType`                             |

## Limitations

- `message.nodeType` member expression accesses are flagged with a TODO but the surrounding expression must be removed manually — the codemod cannot determine what to replace the access with.
- Fixer non-string argument validation is not automatable — check manually if you call `fixer.insertTextBefore(node, nonString)`.
- `loadESLint({ useFlatConfig: true/false, ...otherOptions })` is **not** transformed when extra options are present alongside `useFlatConfig` — remove `useFlatConfig` manually in those cases.
- `new Linter({ configType: 'eslintrc', ...otherOptions })` is **not** flagged with a TODO when additional options are present — add the TODO comment manually.
- `func-names` options with nested objects (e.g. `{ generators: { mode: 'strict' } }`) are **not** transformed — the regex only matches flat (non-nested) options objects.
- `radix` rule with `"always"` is only stripped when it is the sole option in the array (e.g. `['error', 'always']`); forms with additional elements are left untouched.

## Resources

- [ESLint v10 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
