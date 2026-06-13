import { ESLint } from 'eslint'

// Removed flags should be stripped
const eslint1 = new ESLint({ flags: [] })
const eslint2 = new ESLint({ flags: [] })
const eslint3 = new ESLint({ flags: [] })
const eslint4 = new ESLint({ flags: [], fix: true })

// Unrelated flags — must not be touched
const eslint5 = new ESLint({ flags: ['some_other_flag'] })
const eslint6 = new ESLint({ flags: [] })
