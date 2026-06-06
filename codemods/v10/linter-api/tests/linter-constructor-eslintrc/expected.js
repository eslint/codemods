import { Linter } from 'eslint'

// configType: 'eslintrc' is removed — add TODO
const linter = new Linter(/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */)

// configType: 'eslintrc' with additional options — remove configType, keep rest, add TODO
const linterLeading = new Linter({ allowInlineConfig: false /* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */ })
const linterTrailing = new Linter({ allowInlineConfig: false /* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */ })
