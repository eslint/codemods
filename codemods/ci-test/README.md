# ci-test

Transform legacy code patterns

## Installation

```bash
# Install from registry
codemod run ci-test

# Or run locally
codemod run -w workflow.yaml
```

## Usage

Document the exact migration this codemod performs before publishing. At minimum, cover:

- The concrete syntax or API patterns it rewrites
- The file types or paths it targets
- Important preserve/no-op cases and exclusions

## Development

```bash
# Test the transformation
npm test

# Validate the workflow
codemod workflow validate -w workflow.yaml

# Publish to registry
codemod login
codemod publish
```

## License

MIT
