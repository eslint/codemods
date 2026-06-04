import { execSync } from 'node:child_process'

// Removed CLI flags must be stripped
execSync('eslint src/')
execSync('eslint src/')
execSync('eslint src/')

// Quoted flag values must also be consumed
execSync('eslint src/')
execSync("eslint src/")
execSync('eslint src/')

// Mixed: valid flags must survive
execSync('eslint --fix --max-warnings 0 src/')
