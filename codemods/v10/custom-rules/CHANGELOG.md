# @eslint/v9-to-v10-custom-rules

## 1.2.0

### Minor Changes

- eafb14f: Remove overly restrictive CAUTION callout from README. The codemod uses precise AST selectors and is safe to run on any codemod package directory.

## 1.1.0

### Minor Changes

- 99dfa4c: Add new codemod to migrate custom ESLint rules from v9 to v10. Replaces removed context methods, SourceCode methods, collapses v8→v9 fallback patterns, and flags no-replacement removals with TODO comments.
