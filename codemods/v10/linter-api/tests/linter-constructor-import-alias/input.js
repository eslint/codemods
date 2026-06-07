// ESM aliased import — the alias name is not matched by the current regex,
// so new EslintLinter(...) is not transformed (current limitation)
import { Linter as EslintLinter } from 'eslint'

const linter1 = new EslintLinter({ configType: 'flat' })
const linter2 = new EslintLinter({ configType: 'eslintrc' })
const linter3 = new EslintLinter({ configType: 'flat', allowInlineConfig: true })
