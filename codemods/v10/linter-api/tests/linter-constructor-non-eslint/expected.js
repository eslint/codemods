// configType on plain objects and arbitrary function calls — should not be changed
const opts = { configType: 'flat' }
configure({ configType: 'flat' })
setup({ configType: 'eslintrc', allowInlineConfig: true })

// Non-Linter class names with same property — should not be changed
const config1 = new Configuration({ configType: 'flat' })
const config2 = new MyLinter({ configType: 'flat' })
const config3 = new BabelLinter({ configType: 'eslintrc' })
const config4 = new TSLinter({ configType: 'flat', allowInlineConfig: false })
