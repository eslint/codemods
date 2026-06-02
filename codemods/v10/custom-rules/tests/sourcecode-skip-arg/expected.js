'use strict'

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        const before = sourceCode.getTokenBefore(node, { includeComments: true, skip: 1 })
        const after = sourceCode.getTokenAfter(node, { includeComments: true, skip: 2 })
      },
    }
  },
}
