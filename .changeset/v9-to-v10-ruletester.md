---
'@eslint/v9-to-v10-ruletester': minor
---

Add new codemod to fix RuleTester test case structure for ESLint v10. Removes `errors` and `output` properties from valid test cases, and removes the `type` property from error matcher objects inside `errors[]` of invalid test cases — all of which v10 now throws on.
