module.exports = {
    create(context) {
        return {
            Program(node) {
                const sourceCodeText = context.getSource();
                const sourceLines = context.getSourceLines();
                const allComments = context.getAllComments();
                const nodeByRangeIndex = context.getNodeByRangeIndex();
                const commentsBefore = context.getCommentsBefore(nodeOrToken);
                const commentsAfter = context.getCommentsAfter(nodeOrToken);
                const commentsInside = context.getCommentsInside(nodeOrToken);
                const jsDocComment = context.getJSDocComment();
                const firstToken = context.getFirstToken(node);
                const firstTokens = context.getFirstTokens(node);
                const lastToken = context.getLastToken(node);
                const lastTokens = context.getLastTokens(node);
                const tokenAfter = context.getTokenAfter(node);
                const tokenBefore = context.getTokenBefore(node);
                const tokenByRangeStart = context.getTokenByRangeStart(node);
                const getTokens = context.getTokens(node);
                const tokensAfter = context.getTokensAfter(node);
                const tokensBefore = context.getTokensBefore(node);
                const tokensBetween = context.getTokensBetween(node);
                const parserServices = context.parserServices;
            },

            FunctionDeclaration(node) {
                const sourceCodeText = context.getSourceCode().getText();
                const sourceLines = context.getSourceCode().getLines();
                const allComments = context.getSourceCode().getAllComments();
                const nodeByRangeIndex = context.getSourceCode().getNodeByRangeIndex();
                const commentsBefore = context.getSourceCode().getCommentsBefore(node);
                const commentsAfter = context.getSourceCode().getCommentsAfter(node);
                const commentsInside = context.getSourceCode().getCommentsInside(node);
                const jsDocComment = context.getSourceCode().getJSDocComment();
                const firstToken = context.getSourceCode().getFirstToken(node);
                const firstTokens = context.getSourceCode().getFirstTokens(node);
                const lastToken = context.getSourceCode().getLastToken(node);
                const lastTokens = context.getSourceCode().getLastTokens(node);
                const tokenAfter = context.getSourceCode().getTokenAfter(node);
                const tokenBefore = context.getSourceCode().getTokenBefore(node);
                const tokenByRangeStart = context.getSourceCode().getTokenByRangeStart(node);
                const getTokens = context.getSourceCode().getTokens(node);
                const tokensAfter = context.getSourceCode().getTokensAfter(node);
                const tokensBefore = context.getSourceCode().getTokensBefore(node);
                const tokensBetween = context.getSourceCode().getTokensBetween(node);
                const parserServices = context.getSourceCode().parserServices;
            },
        };
    }
};
