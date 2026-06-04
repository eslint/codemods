import { loadESLint } from 'eslint'

// useFlatConfig removed — loadESLint() uses flat config by default in v10
const ESLintFlat = await loadESLint()
const ESLintLegacy = await loadESLint()

// No useFlatConfig — must not be touched
const ESLint = await loadESLint()
