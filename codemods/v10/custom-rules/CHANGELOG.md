# @eslint/v9-to-v10-custom-rules

## 1.3.0

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

## 1.2.1

### Patch Changes

- 1f73b58: fix: update v9-v10 custom-rules workflow globs to include TS extension

## 1.2.0

### Minor Changes

- eafb14f: Remove overly restrictive CAUTION callout from README. The codemod uses precise AST selectors and is safe to run on any codemod package directory.

## 1.1.0

### Minor Changes

- 99dfa4c: Add new codemod to migrate custom ESLint rules from v9 to v10. Replaces removed context methods, SourceCode methods, collapses v8→v9 fallback patterns, and flags no-replacement removals with TODO comments.
