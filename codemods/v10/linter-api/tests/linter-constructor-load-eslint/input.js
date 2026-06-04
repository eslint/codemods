import { loadESLint } from 'eslint'

// useFlatConfig removed — loadESLint() uses flat config by default in v10
const ESLintFlat = await loadESLint({ useFlatConfig: true })
const ESLintLegacy = await loadESLint({ useFlatConfig: false })

// No useFlatConfig — must not be touched
const ESLint = await loadESLint()
