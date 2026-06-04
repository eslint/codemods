// Simulates content found in a GitHub Actions workflow or shell script
const ciWorkflow = `
jobs:
  lint:
    steps:
      - run: ESLINT_USE_FLAT_CONFIG=true npx eslint .
      - run: ESLINT_FLAGS=v10_config_lookup_from_file npx eslint .
      - run: npx eslint . --no-eslintrc --env browser
`
