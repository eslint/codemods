import { execSync } from 'node:child_process'

// Removed env vars must be stripped
execSync('eslint .')
execSync('eslint . --fix')

// ESLINT_FLAGS with removed flag values
process.env.ESLINT_FLAGS = ''
process.env.ESLINT_FLAGS = ''

// Unrelated env var — must not be touched
process.env.NODE_ENV = 'production'
