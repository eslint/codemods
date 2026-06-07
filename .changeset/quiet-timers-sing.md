---
"@eslint/v8-to-v9-config": patch
---

Recognize single-quoted and `node:`-prefixed builtin module specifiers when adding `__dirname` helper imports, preventing duplicate `path` imports for configs that already require `node:path` while emitting `node:url` and `node:path` helpers.
