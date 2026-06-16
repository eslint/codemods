---
'@eslint/v8-to-v9-config': patch
---

Fix v9 rule migrations when duplicate rule keys appear in eslintrc `rules` objects.

- Use the last duplicate entry for `no-constructor-return`, `no-sequences`, `no-unused-vars`, `no-useless-computed-key`, and `camelcase` migrations, matching JavaScript object literal semantics
- Expand `package.json` formatter migration tests to cover all seven removed built-in formatters
