module.exports = {
  meta: {
    docs: {},
    schema: []
  },
 
    create(context) {
    const contextSourceCode = context.sourceCode ?? context.getSourceCode();
        return {
            Program(node) {
                const sourceCodeText = contextSourceCode.getText();
                const sourceLines = contextSourceCode.getLines();
                const allComments = contextSourceCode.getAllComments();
                const nodeByRangeIndex = contextSourceCode.getNodeByRangeIndex();
                const commentsBefore = contextSourceCode.getCommentsBefore(nodeOrToken);
                const commentsAfter = contextSourceCode.getCommentsAfter(nodeOrToken);
                const commentsInside = contextSourceCode.getCommentsInside(nodeOrToken);
                const jsDocComment = contextSourceCode.getJSDocComment();
                const firstToken = contextSourceCode.getFirstToken(node);
                const firstTokens = contextSourceCode.getFirstTokens(node);
                const lastToken = contextSourceCode.getLastToken(node);
                const lastTokens = contextSourceCode.getLastTokens(node);
                const tokenAfter = contextSourceCode.getTokenAfter(node);
                const tokenBefore = contextSourceCode.getTokenBefore(node);
                const tokenByRangeStart = contextSourceCode.getTokenByRangeStart(node);
                const getTokens = contextSourceCode.getTokens(node);
                const tokensAfter = contextSourceCode.getTokensAfter(node);
                const tokensBefore = contextSourceCode.getTokensBefore(node);
                const tokensBetween = contextSourceCode.getTokensBetween(node);
                const parserServices = context.parserServices;
            },

            FunctionDeclaration(node) {
                const sourceCodeText = contextSourceCode.getText();
                const sourceLines = contextSourceCode.getLines();
                const allComments = contextSourceCode.getAllComments();
                const nodeByRangeIndex = contextSourceCode.getNodeByRangeIndex();
                const commentsBefore = contextSourceCode.getCommentsBefore(node);
                const commentsAfter = contextSourceCode.getCommentsAfter(node);
                const commentsInside = contextSourceCode.getCommentsInside(node);
                const jsDocComment = contextSourceCode.getJSDocComment();
                const firstToken = contextSourceCode.getFirstToken(node);
                const firstTokens = contextSourceCode.getFirstTokens(node);
                const lastToken = contextSourceCode.getLastToken(node);
                const lastTokens = contextSourceCode.getLastTokens(node);
                const tokenAfter = contextSourceCode.getTokenAfter(node);
                const tokenBefore = contextSourceCode.getTokenBefore(node);
                const tokenByRangeStart = contextSourceCode.getTokenByRangeStart(node);
                const getTokens = contextSourceCode.getTokens(node);
                const tokensAfter = contextSourceCode.getTokensAfter(node);
                const tokensBefore = contextSourceCode.getTokensBefore(node);
                const tokensBetween = contextSourceCode.getTokensBetween(node);
                const parserServices = contextSourceCode.parserServices;
            },
        };
    }
};
