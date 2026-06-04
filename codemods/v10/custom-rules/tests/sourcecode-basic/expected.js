'use strict'

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        const before = sourceCode.getTokenBefore(node, { includeComments: true })
        const after = sourceCode.getTokenAfter(node, { includeComments: true })
        const space = sourceCode.isSpaceBetween(before, after)
        const doc = (null /* TODO: getJSDocComment removed in ESLint v10, no replacement */)
      },
    }
  },
}
