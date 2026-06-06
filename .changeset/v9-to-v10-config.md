---
'@eslint/v9-to-v10-config': minor
---

Add new codemod to remove legacy env vars and CLI flags for ESLint v10. Removes ESLINT_USE_FLAT_CONFIG, v10_config_lookup_from_file, and removed CLI flags. Note: eslint-env inline comments are not removed automatically — see README for the required manual migration step.
