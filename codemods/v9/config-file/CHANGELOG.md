# @eslint/v8-to-v9-config

## 1.9.38

### Patch Changes

- 1624069: Recognize single-quoted and `node:`-prefixed builtin module specifiers when adding `__dirname` helper imports, preventing duplicate `url`/`path` helper imports when configs already import from `node:url` or `node:path`.

## 1.9.37

### Patch Changes

- bddc18a: fix: handle CRLF line endings in ignore files
