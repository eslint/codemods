---
'@eslint/v9-to-v10-config': minor
---

Add new codemod to remove eslint-env inline comments and legacy flags for ESLint v10. ESLint v10 throws a lint error on eslint-env comments and removes ESLINT_USE_FLAT_CONFIG, v10_config_lookup_from_file, and several CLI flags.
