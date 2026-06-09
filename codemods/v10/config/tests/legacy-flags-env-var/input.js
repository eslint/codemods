import { execSync } from 'node:child_process'

// Removed env vars must be stripped
execSync('ESLINT_USE_FLAT_CONFIG=true eslint .')
execSync('ESLINT_USE_FLAT_CONFIG=false eslint . --fix')

// ESLINT_FLAGS with removed flag values
process.env.ESLINT_FLAGS = 'v10_config_lookup_from_file'
process.env.ESLINT_FLAGS = 'unstable_config_lookup_from_file,unstable_ts_config'

// Unrelated env var — must not be touched
process.env.NODE_ENV = 'production'
