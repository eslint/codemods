import { loadESLint } from 'eslint'

// useFlatConfig removed — loadESLint() uses flat config by default in v10
const ESLintFlat = await loadESLint()
const ESLintLegacy = await loadESLint()

// useFlatConfig with additional options — remove only useFlatConfig, keep the rest
const ESLintFlatLeading = await loadESLint({ cwd: '/path' })
const ESLintFlatTrailing = await loadESLint({ cwd: '/path' })

// No useFlatConfig — must not be touched
const ESLint = await loadESLint()
