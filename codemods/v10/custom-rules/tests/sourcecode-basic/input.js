'use strict'

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      CallExpression(node) {
        const before = sourceCode.getTokenOrCommentBefore(node)
        const after = sourceCode.getTokenOrCommentAfter(node)
        const space = sourceCode.isSpaceBetweenTokens(before, after)
        const doc = sourceCode.getJSDocComment(node)
      },
    }
  },
}
