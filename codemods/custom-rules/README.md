# @codemod/eslint-custom-rules-v8-to-v9

Automatically migrate your custom ESLint rules from v8 to v9 format.

## Overview

This codemod transforms your custom ESLint rules to be compatible with ESLint v9. It handles all breaking changes in the custom rule API, including context method removals, new rule structure requirements, and deprecated APIs.

## What This Codemod Does

This codemod performs a comprehensive migration of custom ESLint rules from v8 to v9. It handles the following breaking changes from the [official ESLint v9 migration guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0):

- ✅ **Removed multiple `context` methods** - migrates to `sourceCode` equivalents
- ✅ **Removed `sourceCode.getComments()`** - converts to combination of `getCommentsBefore/Inside/After`
- ✅ **Removed `CodePath#currentSegments`** - adds code path tracking logic
- ✅ **Function-style rules are no longer supported** - converts to object format with `meta` and `create`

### Detailed Transformations:

#### Custom Rule Migration

Transforms your custom ESLint rules to the new format:

- **Converts** old function-based rule exports to the new object format with `meta` and `create` properties
- **Updates** `context` method calls to use `context.sourceCode` (e.g., `context.getSource()` → `contextSourceCode.getText()`)
- **Migrates** deprecated methods:
  - `getSource` → `getText`
  - `getSourceLines` → `getLines`
  - `getComments` → combination of `getCommentsBefore/Inside/After`
  - `getAncestors`, `getScope`, `markVariableAsUsed` with TODO comments for new parameters
- **Handles** `currentSegments` API changes by adding necessary code path tracking
- **Detects** fixable rules and adds `fixable: "code"` to meta

## Usage

### Migrate Custom Rules

Run the codemod and provide paths to your rule files or directories:

```bash
npx codemod@latest run @codemod/eslint-custom-rules-v8-to-v9

# Or run locally
npx codemod@latest workflow run -w workflow.yaml
```

You'll be prompted to provide paths to your rule files or directories:

```bash
# The codemod will ask for paths during execution
Enter custom rules paths (comma-separated):
src/eslint-rules, lib/rules/custom-rule.js
```

## Manual Steps Required

After running this codemod, you need to:

1. **Review TODO comments** in migrated custom rules for context method migrations:

   | **Removed on `context`**           | **Replacement on `SourceCode`**             |
   | ---------------------------------- | ------------------------------------------- |
   | `context.getAncestors()`           | `sourceCode.getAncestors(node)`             |
   | `context.getScope()`               | `sourceCode.getScope(node)`                 |
   | `context.markVariableAsUsed(name)` | `sourceCode.markVariableAsUsed(name, node)` |

2. **Test your custom rules**:

```bash
# Run your rule tests
npm test
```

## Resources

### Official ESLint Documentation

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Preparing Custom Rules for ESLint v9](https://eslint.org/blog/2023/09/preparing-custom-rules-eslint-v9/)
