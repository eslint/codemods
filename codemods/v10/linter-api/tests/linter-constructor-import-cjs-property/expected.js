// CJS namespace access — new eslint.Linter() uses a member expression,
// which is not matched by the current regex (current limitation)
const eslint = require('eslint')
const linter1 = new eslint.Linter({ configType: 'flat' })
const linter2 = new eslint.Linter({ configType: 'eslintrc' })

// CJS property extraction — Linter is bound to the same name, so it IS matched
const Linter = require('eslint').Linter
const linter3 = new Linter()
const linter4 = new Linter(/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */)
const linter5 = new Linter({ allowInlineConfig: true })
