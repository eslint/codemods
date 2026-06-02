'use strict'

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        const value = sourceCode.getTokenOrCommentBefore(node).value
        const type = sourceCode.getTokenOrCommentAfter(node).type
      },
    }
  },
}
