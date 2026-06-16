module.exports = {
  create(context) {
    return {
      Program(node) {
        const comments = context.getSourceCode().getComments();
        return comments.length;
      },
    };
  },
};
