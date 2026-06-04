// Simulates content found in a GitHub Actions workflow or shell script
const ciWorkflow = `
jobs:
  lint:
    steps:
      - run: npx eslint .
      - run: ESLINT_FLAGS= npx eslint .
      - run: npx eslint .
`
