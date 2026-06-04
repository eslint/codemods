const pkg = {
  scripts: {
    lint: 'ESLINT_USE_FLAT_CONFIG=true eslint .',
    'lint:fix': 'ESLINT_USE_FLAT_CONFIG=true eslint . --fix',
    'lint:ci': 'ESLINT_USE_FLAT_CONFIG=false eslint . --max-warnings 0',
    build: 'tsc --noEmit',
  },
}
