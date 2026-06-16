module.exports = {
  meta: {
    docs: {},
    schema: []
  },
 
  create(context) {
    const contextSourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program(node) {
        const comments = [...contextSourceCode.getCommentsBefore(), ...contextSourceCode.getCommentsInside(), ...contextSourceCode.getCommentsAfter()];
        return comments.length;
      },
    };
  },
};
