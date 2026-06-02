# @eslint/v9-to-v10-custom-rules

Migrate custom ESLint rules from v9 to v10.

## Overview

> [!CAUTION]
> Run this codemod only in directories containing ESLint rule files. It may incorrectly transform other JavaScript files that happen to use identifiers with the same method names.

ESLint v10 removes context methods and SourceCode methods that were deprecated in v9. This codemod rewrites all removed API calls to their v10 equivalents.

## What This Codemod Does

- ✅ **Removed context methods** — replaces `context.getFilename()`, `context.getPhysicalFilename()`, `context.getCwd()`, `context.getSourceCode()` with their property equivalents
- ✅ **`context.parserOptions`** — replaces with `context.languageOptions.parserOptions`
- ✅ **`context.parserPath`** — inserts a `// TODO` comment (no replacement exists)
- ✅ **v8→v9 fallback patterns** — collapses `context.filename ?? context.getFilename()` to `context.filename`
- ✅ **Removed SourceCode methods** — replaces `getTokenOrCommentBefore`, `getTokenOrCommentAfter`, `isSpaceBetweenTokens`; inserts `// TODO` for `getJSDocComment`
- ✅ **Optional `skip` argument** — correctly migrates `getTokenOrCommentBefore(node, skip)` to `getTokenBefore(node, { includeComments: true, skip })`

### Transformations

**Context methods:**

```js
// Before
const file = context.getFilename()
const phys = context.getPhysicalFilename()
const cwd  = context.getCwd()
const src  = context.getSourceCode()
const opts = context.parserOptions

// After
const file = context.filename
const phys = context.physicalFilename
const cwd  = context.cwd
const src  = context.sourceCode
const opts = context.languageOptions.parserOptions
```

**v8→v9 fallback cleanup:**

```js
// Before (pattern emitted by the v8→v9 codemod)
const file = context.filename ?? context.getFilename()

// After
const file = context.filename
```

**SourceCode methods:**

```js
// Before
const before = sourceCode.getTokenOrCommentBefore(node)
const after  = sourceCode.getTokenOrCommentAfter(node, 1)
const space  = sourceCode.isSpaceBetweenTokens(tokenA, tokenB)
const doc    = sourceCode.getJSDocComment(node)

// After
const before = sourceCode.getTokenBefore(node, { includeComments: true })
const after  = sourceCode.getTokenAfter(node, { includeComments: true, skip: 1 })
const space  = sourceCode.isSpaceBetween(tokenA, tokenB)
const doc    = (null /* TODO: getJSDocComment removed in ESLint v10, no replacement */)
```

## Usage

```bash
npx codemod @eslint/v9-to-v10-custom-rules
```

Or run locally from source:

```bash
npx codemod workflow run -w codemods/v10/custom-rules/workflow.yaml
```

## Manual Steps Required

After running this codemod, search your files for `TODO` comments and address each one:

| TODO comment | Action required |
|---|---|
| `context.parserPath removed in ESLint v10, no replacement` | Remove the usage. If you were checking the parser, use `context.languageOptions.parser` instead (the value is the parser object, not a path string) |
| `getJSDocComment removed in ESLint v10, no replacement` | Remove the usage. If you need JSDoc information, use a third-party library or implement the logic manually using `sourceCode.getCommentsBefore(node)` |

## Resources

- [ESLint v10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- [Removal of deprecated context members — issue #16999](https://github.com/eslint/eslint/issues/16999)
- [Removal of deprecated SourceCode methods — issue #20113](https://github.com/eslint/eslint/issues/20113)
