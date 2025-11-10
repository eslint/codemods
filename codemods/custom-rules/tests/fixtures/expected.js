/**
 * Comprehensive ESLint v8 Custom Rule with ALL Deprecated API Coverage
 * This rule demonstrates all deprecated patterns that need migration to v9
 */

// OLD FORMAT: Direct function export (needs migration to object format with meta)
module.exports = {
  meta: {
    docs: {},
    fixable: "code",
    schema: [
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
    ],
  },
  create: (context) => {
    let newCurrentCodePath;
    let newCurrentSegments;
    const allCurrentSegments = [];

    const contextSourceCode = context.sourceCode ?? context.getSourceCode();
    // DEPRECATED: Direct context method calls (should use sourceCode)
    const sourceCode = contextSourceCode.getSourceCode();
    const cwd = contextSourceCode.getCwd();
    const filename = contextSourceCode.getFilename();
    const physicalFilename = contextSourceCode.getPhysicalFilename();

    // DEPRECATED: codePath.currentSegments access
    let currentSegment = newCurrentSegments;

    return {
      onCodePathStart(codePath) {
        newCurrentCodePath = codePath;
        allCurrentSegments.push(newCurrentSegments);
        newCurrentSegments = new Set();
      },
      onCodePathEnd(codePath) {
        newCurrentCodePath = codePath.upper;
        newCurrentSegments = allCurrentSegments.pop();
      },
      onCodePathSegmentStart(segment) {
        newCurrentSegments.add(segment);
      },
      onCodePathSegmentEnd(segment) {
        newCurrentSegments.delete(segment);
      },
      onUnreachableCodePathSegmentStart(segment) {
        newCurrentSegments.add(segment);
      },
      onUnreachableCodePathSegmentEnd(segment) {
        newCurrentSegments.delete(segment);
      },

      Program(node) {
        // DEPRECATED: context.getSource() - should be sourceCode.getText()
        const sourceCodeText = contextSourceCode.getText();

        // DEPRECATED: context.getSourceLines() - should be sourceCode.getLines()
        const sourceLines = contextSourceCode.getLines();

        // DEPRECATED: context.getAllComments() - should be sourceCode.getAllComments()
        const allComments = contextSourceCode.getAllComments();

        // DEPRECATED: context.getComments() - needs special handling
        const allComment =
          contextSourceCode.getCommentsBefore() +
          contextSourceCode.getCommentsInside() +
          contextSourceCode.getCommentsAfter();

        // DEPRECATED: context.getNodeByRangeIndex() - should be sourceCode.getNodeByRangeIndex()
        const nodeByRangeIndex = contextSourceCode.getNodeByRangeIndex(10);
      },

      FunctionDeclaration(node) {
        // DEPRECATED: context.getCommentsBefore() - should be sourceCode.getCommentsBefore()
        const commentsBefore = contextSourceCode.getCommentsBefore(node);

        // DEPRECATED: context.getCommentsAfter() - should be sourceCode.getCommentsAfter()
        const commentsAfter = contextSourceCode.getCommentsAfter(node);

        // DEPRECATED: context.getCommentsInside() - should be sourceCode.getCommentsInside()
        const commentsInside = contextSourceCode.getCommentsInside(node);

        // DEPRECATED: context.getJSDocComment() - should be sourceCode.getJSDocComment()
        const jsDocComment = contextSourceCode.getJSDocComment(node);
      },

      CallExpression(node) {
        // DEPRECATED: context.getFirstToken() - should be sourceCode.getFirstToken()
        const firstToken = contextSourceCode.getFirstToken(node);

        // DEPRECATED: context.getFirstTokens() - should be sourceCode.getFirstTokens()
        const firstTokens = contextSourceCode.getFirstTokens(node, 2);

        // DEPRECATED: context.getLastToken() - should be sourceCode.getLastToken()
        const lastToken = contextSourceCode.getLastToken(node);

        // DEPRECATED: context.getLastTokens() - should be sourceCode.getLastTokens()
        const lastTokens = contextSourceCode.getLastTokens(node, 2);

        // DEPRECATED: context.getTokenAfter() - should be sourceCode.getTokenAfter()
        const tokenAfter = contextSourceCode.getTokenAfter(node);

        // DEPRECATED: context.getTokenBefore() - should be sourceCode.getTokenBefore()
        const tokenBefore = contextSourceCode.getTokenBefore(node);

        // DEPRECATED: context.getTokenByRangeStart() - should be sourceCode.getTokenByRangeStart()
        const tokenByRangeStart = contextSourceCode.getTokenByRangeStart(
          node.range[0]
        );

        // DEPRECATED: context.getTokens() - should be sourceCode.getTokens()
        const tokens = contextSourceCode.getTokens(node);

        // DEPRECATED: context.getTokensAfter() - should be sourceCode.getTokensAfter()
        const tokensAfter = contextSourceCode.getTokensAfter(node);

        // DEPRECATED: context.getTokensBefore() - should be sourceCode.getTokensBefore()
        const tokensBefore = contextSourceCode.getTokensBefore(node);

        // DEPRECATED: context.getTokensBetween() - should be sourceCode.getTokensBetween()
        const tokensBetween = contextSourceCode.getTokensBetween(
          node,
          node.parent
        );
      },

      VariableDeclaration(node) {
        // DEPRECATED: context.parserServices - should be sourceCode.parserServices
        const parserServices = context.parserServices;

        // DEPRECATED: context.getDeclaredVariables() - should be sourceCode.getDeclaredVariables()
        const declaredVariables = contextSourceCode.getDeclaredVariables(node);

        // DEPRECATED: context.getAncestors() - should be sourceCode.getAncestors(node)
        const ancestors = contextSourceCode.getAncestors(node); //TODO: new node param
        // DEPRECATED: context.getScope() - should be sourceCode.getScope(node)
        const scope = contextSourceCode.getScope(node); //TODO: new node param
        // DEPRECATED: context.markVariableAsUsed() - should be sourceCode.markVariableAsUsed(name, node)
        contextSourceCode.markVariableAsUsed(name, node); //TODO: new name, code params
      },

      Identifier(node) {
        // Example usage that would trigger a fix
        contextSourceCode.report({
          node,
          message: "Example rule violation",
          fix(fixer) {
            return fixer.replaceText(node, "fixed");
          },
        });
      },
    };
  },
};

// DEPRECATED: Schema defined separately (should be in meta.schema)
