import { execSync } from 'node:child_process'

// Removed CLI flags must be stripped
execSync('eslint --no-eslintrc --env browser src/')
execSync('eslint --rulesdir ./rules --ignore-path .gitignore src/')
execSync('eslint --resolve-plugins-relative-to . src/')

// Mixed: valid flags must survive
execSync('eslint --fix --max-warnings 0 src/')
