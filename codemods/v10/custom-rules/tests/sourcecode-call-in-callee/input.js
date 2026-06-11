'use strict'

// isSpaceBetweenTokens where the receiver is itself a call expression.
// E.g., eslint-plugin-react pattern: getSourceCode(context).isSpaceBetweenTokens(a, b)
// The codemod must pass through a and b, not the inner argument (context).
module.exports = {
  create(context) {
    const sourceCode = context.sourceCode
    return {
      JSXOpeningElement(node) {
        const leftToken = sourceCode.getLastToken(node)
        const rightToken = sourceCode.getFirstToken(node)
        const adjacent = !getSourceCode(context).isSpaceBetweenTokens(leftToken, rightToken)
        const spaced = getSourceCode(context).isSpaceBetweenTokens(leftToken, rightToken)
      },
    }
  },
}
