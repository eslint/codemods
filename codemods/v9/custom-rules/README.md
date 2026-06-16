# @eslint/v8-to-v9-custom-rules

Automatically migrate your custom ESLint rules from v8 to v9 format.

## Overview

> [!CAUTION]
> **Important:** Run this codemod only in directories containing ESLint rule files. It may incorrectly transform other JavaScript files that export functions.

This codemod transforms your custom ESLint rules to be compatible with ESLint v9. It handles all breaking changes in the custom rule API, including context method removals, new rule structure requirements, and deprecated APIs.

**Supported export styles:**

- CommonJS: `module.exports = function(context) { ... }`
- ES Modules: `export default function(context) { ... }`

## What This Codemod Does

This codemod performs a comprehensive migration of custom ESLint rules from v8 to v9. It handles the following breaking changes from the [official ESLint v9 migration guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0):

- ✅ **Removed multiple `context` methods** - migrates to `sourceCode` equivalents
- ✅ **Removed `context.getComments()`** - converts to combination of `getCommentsBefore/Inside/After`
- ✅ **Removed `CodePath#currentSegments`** - adds code path tracking logic
- ✅ **Function-style rules are no longer supported** - converts to object format with `meta` and `create`
- ✅ **Removed `sourceCode.getComments()`** - converts to `getCommentsBefore/Inside/After` combinations
- ✅ **`FlatRuleTester` → `RuleTester`** - renames imports/usages and moves `parserOptions` to `languageOptions` in tests
- ✅ **`FlatESLint` → `ESLint`** and **`Linter#verify` flat config** - updates integration API usage

### Detailed Transformations:

#### Custom Rule Migration

Transforms your custom ESLint rules to the new format:

**CommonJS:**

```javascript
// Before
module.exports = function(context) { return { ... }; };

// After
module.exports = {
  meta: { docs: {}, schema: [] },
  create: function(context) { return { ... }; }
};
```

**ES Modules:**

```javascript
// Before
export default function(context) { return { ... }; };

// After
export default {
  meta: { docs: {}, schema: [] },
  create: function(context) { return { ... }; }
};
```

- **Converts** old function-based rule exports to the new object format with `meta` and `create` properties
- **Updates** `context` method calls to use `context.sourceCode` (e.g., `context.getSource()` → `contextSourceCode.getText()`)
- **Migrates** deprecated methods:
  - `getSource` → `getText`
  - `getSourceLines` → `getLines`
  - `getComments` → `[...getCommentsBefore(), ...getCommentsInside(), ...getCommentsAfter()]`
  - `getAncestors`, `getScope`, `markVariableAsUsed` — auto-migrated with inferred `node` parameters (verify manually)
- **Handles** `currentSegments` API changes by adding necessary code path tracking
- **Detects** fixable rules and adds `fixable: "code"` to meta

## Usage

### Migrate Custom Rules

Run the codemod and provide paths to your rule files or directories:

```bash
npx codemod @eslint/v8-to-v9-custom-rules

# Or run locally
npx codemod workflow run -w workflow.yaml
```

## Manual Steps Required

After running this codemod, you need to:

1. **Review TODO comments** - If your rule uses `context.options`, the codemod may leave a schema placeholder:

   | **TODO Comment**                                          | **Action Required**                                 |
   | --------------------------------------------------------- | --------------------------------------------------- |
   | `// TODO: Define schema - this rule uses context.options` | Define a proper JSON schema for your rule's options |

2. **Fix schema for rules using options** - If your rule uses `context.options`, you must define the schema:

   ```javascript
   // Before (generated with TODO)
   schema: [] // TODO: Define schema - this rule uses context.options

   // After (manually fixed)
   schema: [
     {
       type: 'integer',
       minimum: 1,
     },
   ]
   ```

3. **Verify scope-related migrations** - The codemod automatically migrates `getScope`, `getAncestors`, and `markVariableAsUsed` with inferred `node` parameters. It does **not** leave TODO comments for these. Review the output to confirm the inferred `node` is correct, especially in nested helpers or non-standard visitor signatures. Parameterless visitors such as `Program() {}` get `(node)` injected automatically.

   For `getAncestors`, the codemod also adds a v8 compatibility fallback:

   ```javascript
   contextSourceCode.getAncestors ? contextSourceCode.getAncestors(node) : context.getAncestors()
   ```

   Other deprecated `context` methods are replaced automatically as well:

   | **Removed on `context`**             | **Replacement on `SourceCode`**                                                                            |
   | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
   | `context.getAncestors()`             | `sourceCode.getAncestors(node)`                                                                            |
   | `context.getScope()`                 | `sourceCode.getScope(node)`                                                                                |
   | `context.markVariableAsUsed(name)`   | `sourceCode.markVariableAsUsed(name, node)`                                                                |
   | `context.getDeclaredVariables(node)` | `sourceCode.getDeclaredVariables(node)`                                                                    |
   | `context.getSource(node)`            | `sourceCode.getText(node)`                                                                                 |
   | `context.getSourceLines()`           | `sourceCode.getLines()`                                                                                    |
   | `context.getAllComments()`           | `sourceCode.getAllComments()`                                                                              |
   | `context.getComments()`              | `[...sourceCode.getCommentsBefore(), ...sourceCode.getCommentsInside(), ...sourceCode.getCommentsAfter()]` |

4. **Test your custom rules**:

```bash
# Run your rule tests
npm test
```

## Resources

### Official ESLint Documentation

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Preparing Custom Rules for ESLint v9](https://eslint.org/blog/2023/09/preparing-custom-rules-eslint-v9/)
