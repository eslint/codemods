const { execSync } = require('node:child_process')
const cp = require('node:child_process')

// Member expression calls — legacy env var and CLI flags must be stripped
cp.execSync('ESLINT_USE_FLAT_CONFIG=true eslint .')
cp.exec('eslint --no-eslintrc --env browser src/', (err) => {})

// Direct call still works when mixed with member calls in the same file
execSync('eslint --rulesdir ./rules src/')
