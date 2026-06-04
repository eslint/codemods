import { Linter } from 'eslint'

// configType: 'flat' is the default in v10 — just remove the option
const linter1 = new Linter()
const linter2 = new Linter({ allowInlineConfig: true })
const linter5 = new Linter({ allowInlineConfig: true })

// No configType — must not be touched
const linter3 = new Linter()
const linter4 = new Linter({ allowInlineConfig: true })
