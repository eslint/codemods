# @eslint/v9-to-v10-linter-api

## 1.1.0

### Minor Changes

- d5e6b28: Add new codemod to migrate removed Linter/ESLint constructor options and stricter rule config schema for ESLint v10. Handles configType removal from new Linter(), useFlatConfig removal from loadESLint(), deprecated flag value removal from new ESLint({ flags }), deprecated Linter instance methods, func-names schema tightening, no-invalid-regexp duplicate flag deduplication, radix deprecated option removal, and LintMessage.nodeType object property removal.
