import { loadESLint } from 'eslint'

// useFlatConfig removed — loadESLint() uses flat config by default in v10
const ESLintFlat = await loadESLint({ useFlatConfig: true })
const ESLintLegacy = await loadESLint({ useFlatConfig: false })

// useFlatConfig with additional options — remove only useFlatConfig, keep the rest
const ESLintFlatLeading = await loadESLint({ useFlatConfig: true, cwd: '/path' })
const ESLintFlatTrailing = await loadESLint({ cwd: '/path', useFlatConfig: false })

// No useFlatConfig — must not be touched
const ESLint = await loadESLint()
