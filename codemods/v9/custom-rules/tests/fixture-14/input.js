/**
 * Comprehensive ESLint v8 Custom Rule with ALL Deprecated API Coverage
 * This rule demonstrates all deprecated patterns that need migration to v9
 */

// OLD FORMAT: Direct function export (needs migration to object format with meta)
module.exports = (context) => {
  // DEPRECATED: Direct context method calls (should use sourceCode)
  const sourceCode = context.getSourceCode();
  const cwd = context.getCwd();
  const filename = context.getFilename();
  const physicalFilename = context.getPhysicalFilename();

  // DEPRECATED: codePath.currentSegments access
  let currentSegment = context.getSourceCode().codePath.currentSegments;

  return {
    Program(node) {
      // DEPRECATED: context.getSource() - should be sourceCode.getText()
      const sourceCodeText = context.getSource();

      // DEPRECATED: context.getSourceLines() - should be sourceCode.getLines()
      const sourceLines = context.getSourceLines();

      // DEPRECATED: context.getAllComments() - should be sourceCode.getAllComments()
      const allComments = context.getAllComments();

      // DEPRECATED: context.getComments() - needs special handling
      const allComment = context.getComments();

      // DEPRECATED: context.getNodeByRangeIndex() - should be sourceCode.getNodeByRangeIndex()
      const nodeByRangeIndex = context.getNodeByRangeIndex(10);
    },

    FunctionDeclaration(node) {
      // DEPRECATED: context.getCommentsBefore() - should be sourceCode.getCommentsBefore()
      const commentsBefore = context.getCommentsBefore(node);

      // DEPRECATED: context.getCommentsAfter() - should be sourceCode.getCommentsAfter()
      const commentsAfter = context.getCommentsAfter(node);

      // DEPRECATED: context.getCommentsInside() - should be sourceCode.getCommentsInside()
      const commentsInside = context.getCommentsInside(node);

      // DEPRECATED: context.getJSDocComment() - should be sourceCode.getJSDocComment()
      const jsDocComment = context.getJSDocComment(node);
    },

    CallExpression(node) {
      // DEPRECATED: context.getFirstToken() - should be sourceCode.getFirstToken()
      const firstToken = context.getFirstToken(node);

      // DEPRECATED: context.getFirstTokens() - should be sourceCode.getFirstTokens()
      const firstTokens = context.getFirstTokens(node, 2);

      // DEPRECATED: context.getLastToken() - should be sourceCode.getLastToken()
      const lastToken = context.getLastToken(node);

      // DEPRECATED: context.getLastTokens() - should be sourceCode.getLastTokens()
      const lastTokens = context.getLastTokens(node, 2);

      // DEPRECATED: context.getTokenAfter() - should be sourceCode.getTokenAfter()
      const tokenAfter = context.getTokenAfter(node);

      // DEPRECATED: context.getTokenBefore() - should be sourceCode.getTokenBefore()
      const tokenBefore = context.getTokenBefore(node);

      // DEPRECATED: context.getTokenByRangeStart() - should be sourceCode.getTokenByRangeStart()
      const tokenByRangeStart = context.getTokenByRangeStart(node.range[0]);

      // DEPRECATED: context.getTokens() - should be sourceCode.getTokens()
      const tokens = context.getTokens(node);

      // DEPRECATED: context.getTokensAfter() - should be sourceCode.getTokensAfter()
      const tokensAfter = context.getTokensAfter(node);

      // DEPRECATED: context.getTokensBefore() - should be sourceCode.getTokensBefore()
      const tokensBefore = context.getTokensBefore(node);

      // DEPRECATED: context.getTokensBetween() - should be sourceCode.getTokensBetween()
      const tokensBetween = context.getTokensBetween(node, node.parent);
    },

    VariableDeclaration(node) {
      // DEPRECATED: context.parserServices - should be sourceCode.parserServices
      const parserServices = context.parserServices;

      // DEPRECATED: context.getDeclaredVariables() - should be sourceCode.getDeclaredVariables()
      const declaredVariables = context.getDeclaredVariables(node);

      // DEPRECATED: context.getAncestors() - should be sourceCode.getAncestors(node)
      const ancestors = context.getAncestors();

      // DEPRECATED: context.getScope() - should be sourceCode.getScope(node)
      const scope = context.getScope();

      // DEPRECATED: context.markVariableAsUsed() - should be sourceCode.markVariableAsUsed(name, node)
      context.markVariableAsUsed("myVar");
    },

    Identifier(node) {
      // Example usage that would trigger a fix
      context.report({
        node,
        message: "Example rule violation",
        fix(fixer) {
          return fixer.replaceText(node, "fixed");
        },
      });
    },
  };
};

// DEPRECATED: Schema defined separately (should be in meta.schema)
module.exports.schema = [
  {
    type: "object",
    properties: {
      ignorePattern: {
        type: "string",
      },
      allowedNames: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    additionalProperties: false,
  },
];
