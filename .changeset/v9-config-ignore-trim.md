---
'@eslint/v8-to-v9-config': patch
---

Trim leading and trailing whitespace from `.eslintignore` and `.gitignore` lines before merging them into `globalIgnores`, preventing stray spaces from breaking ignore patterns. Also fix the misspelled `transform-eslintrc-yaml-no-globals-for-env` test directory name so it runs under the `transform-eslintrc` filter.
