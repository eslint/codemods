const pkg = {
  scripts: {
    lint: 'eslint .',
    'lint:fix': 'eslint . --fix',
    'lint:ci': 'eslint . --max-warnings 0',
    build: 'tsc --noEmit',
  },
}
