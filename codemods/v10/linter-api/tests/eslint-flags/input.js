import { ESLint } from 'eslint'

// Removed flags should be stripped
const eslint1 = new ESLint({ flags: ['v10_config_lookup_from_file'] })
const eslint2 = new ESLint({ flags: ['unstable_config_lookup_from_file'] })
const eslint3 = new ESLint({ flags: ['v10_config_lookup_from_file', 'unstable_config_lookup_from_file'] })
const eslint4 = new ESLint({ flags: ['v10_config_lookup_from_file'], fix: true })

// Unrelated flags — must not be touched
const eslint5 = new ESLint({ flags: ['some_other_flag'] })
const eslint6 = new ESLint({ flags: [] })
