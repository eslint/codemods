// Dynamic import with await — destructured name matches, so it is transformed
const { Linter } = await import('eslint')
const linter1 = new Linter({ configType: 'flat' })
const linter2 = new Linter({ configType: 'eslintrc' })
const linter3 = new Linter({ configType: 'flat', allowInlineConfig: true })

// Dynamic import via .then() with a renamed binding — the alias is not matched,
// so new EslintLinter(...) is not transformed (current limitation)
import('eslint').then(({ Linter: EslintLinter }) => {
  const linter4 = new EslintLinter({ configType: 'flat' })
})
