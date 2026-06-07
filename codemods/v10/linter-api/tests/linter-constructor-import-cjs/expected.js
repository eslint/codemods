const { Linter } = require('eslint')

// configType: 'flat' is the default in v10 — remove it
const linter1 = new Linter()
const linter2 = new Linter({ allowInlineConfig: true })
const linter3 = new Linter({ allowInlineConfig: true })

// configType: 'eslintrc' is removed — add TODO
const linter4 = new Linter(/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */)
const linter5 = new Linter({ allowInlineConfig: false /* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */ })

// No configType — must not be touched
const linter6 = new Linter()
const linter7 = new Linter({ allowInlineConfig: true })
