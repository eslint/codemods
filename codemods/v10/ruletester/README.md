# @eslint/v9-to-v10-ruletester

Fix `RuleTester` test case structure for ESLint v10.

## Overview

ESLint v10 throws an error when `RuleTester` test case objects contain properties that were silently ignored in v9. This codemod removes those properties automatically.

## What This Codemod Does

- ✅ **`errors` in valid cases** — removes `errors` property from objects inside `valid` arrays (v10 throws if present)
- ✅ **`output` in valid cases** — removes `output` property from objects inside `valid` arrays (v10 throws if present)
- ✅ **`type` in invalid cases** — removes `type` property from objects inside `invalid` arrays (v10 throws if present)

### Transformations

**Valid cases — remove `errors` and `output`:**

```js
// Before
ruleTester.run('my-rule', rule, {
  valid: [{ code: 'var x = 1', errors: [], output: null }],
})

// After
ruleTester.run('my-rule', rule, {
  valid: [{ code: 'var x = 1' }],
})
```

**Invalid cases — remove `type`:**

```js
// Before
ruleTester.run('my-rule', rule, {
  invalid: [{ code: 'eval(x)', type: 'CallExpression', errors: [{ messageId: 'noEval' }] }],
})

// After
ruleTester.run('my-rule', rule, {
  invalid: [{ code: 'eval(x)', errors: [{ messageId: 'noEval' }] }],
})
```

## Usage

```bash
npx codemod @eslint/v9-to-v10-ruletester
```

Or run locally from source:

```bash
npx codemod workflow run -w codemods/v10/ruletester/workflow.yaml
```

## Resources

- [ESLint v10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- [Removal of `type` in invalid RuleTester cases](https://eslint.org/docs/latest/use/migrate-to-10.0.0#ruletester-type-removed)
- [Prohibiting `errors`/`output` in valid RuleTester cases](https://eslint.org/docs/latest/use/migrate-to-10.0.0#stricter-rule-tester)
