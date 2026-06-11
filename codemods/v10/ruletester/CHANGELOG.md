# @eslint/v9-to-v10-ruletester

## 1.2.0

### Minor Changes

- 3698ac6: Fix false positives and missed patterns in custom-rules and ruletester codemods

  custom-rules:
  - Replace context methods (getSourceCode, getFilename, etc.) and parserOptions now only
    apply to the ESLint rule `context` object — not to arbitrary utility/config objects
    that happen to have the same property names
  - Ternary backward-compat guards (context.getMethod ? context.getMethod() : context.prop)
    are now collapsed to the v10 property, matching the existing ?? fallback handling
  - Fix argument extraction for isSpaceBetweenTokens when the receiver is itself a call
    expression (e.g. getSourceCode(context).isSpaceBetweenTokens(a, b))

  ruletester:
  - Remove top-level `type` from invalid test cases generated via array.map() spread
    (e.g. `...cases.map(code => ({ type, code, errors }))`) — previously only direct
    array members were handled

## 1.1.0

### Minor Changes

- bff48fe: Add new codemod to fix RuleTester test case structure for ESLint v10. Removes `errors` and `output` properties from valid test cases, and removes the `type` property from error matcher objects inside `errors[]` of invalid test cases — all of which v10 now throws on.
