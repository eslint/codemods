const { Linter } = require('eslint')

// configType: 'flat' is the default in v10 — remove it
const linter1 = new Linter({ configType: 'flat' })
const linter2 = new Linter({ configType: 'flat', allowInlineConfig: true })
const linter3 = new Linter({ allowInlineConfig: true, configType: 'flat' })

// configType: 'eslintrc' is removed — add TODO
const linter4 = new Linter({ configType: 'eslintrc' })
const linter5 = new Linter({ configType: 'eslintrc', allowInlineConfig: false })

// No configType — must not be touched
const linter6 = new Linter()
const linter7 = new Linter({ allowInlineConfig: true })
