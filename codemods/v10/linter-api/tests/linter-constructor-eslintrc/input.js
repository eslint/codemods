import { Linter } from 'eslint'

// configType: 'eslintrc' is removed — add TODO
const linter = new Linter({ configType: 'eslintrc' })

// configType: 'eslintrc' with additional options — remove configType, keep rest, add TODO
const linterLeading = new Linter({ configType: 'eslintrc', allowInlineConfig: false })
const linterTrailing = new Linter({ allowInlineConfig: false, configType: 'eslintrc' })
