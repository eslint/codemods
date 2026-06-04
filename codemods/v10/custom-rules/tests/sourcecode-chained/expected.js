'use strict'

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        const value = sourceCode.getTokenBefore(node, { includeComments: true }).value
        const type = sourceCode.getTokenAfter(node, { includeComments: true }).type
      },
    }
  },
}
