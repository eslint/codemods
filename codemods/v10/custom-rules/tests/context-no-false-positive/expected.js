'use strict'

// These are utility/wrapper objects — NOT the ESLint rule context.
// The codemod must NOT replace method calls or parserOptions on them.

const src = eslintUtil.getSourceCode(context)
const file = utils.getFilename()
const cwd = helpers.getCwd()
const opts = legacyConfig.parserOptions

// Accessing parserOptions on a non-context object should also be left alone.
function buildOptions(config) {
  return config.parserOptions
}
