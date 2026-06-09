---
'@eslint/v8-to-v9-config': patch
---

Recognize single-quoted and `node:`-prefixed builtin module specifiers when adding `__dirname` helper imports, preventing duplicate `url`/`path` helper imports when configs already import from `node:url` or `node:path`.
