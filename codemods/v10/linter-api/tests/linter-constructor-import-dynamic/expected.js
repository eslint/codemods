// Dynamic import with await — destructured name matches, so it is transformed
const { Linter } = await import('eslint')
const linter1 = new Linter()
const linter2 = new Linter(/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */)
const linter3 = new Linter({ allowInlineConfig: true })

// Dynamic import via .then() with a renamed binding — the alias is not matched,
// so new EslintLinter(...) is not transformed (current limitation)
import('eslint').then(({ Linter: EslintLinter }) => {
  const linter4 = new EslintLinter({ configType: 'flat' })
})
