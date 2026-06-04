'use strict'

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        const before = sourceCode.getTokenOrCommentBefore(node, 1)
        const after = sourceCode.getTokenOrCommentAfter(node, 2)
      },
    }
  },
}
