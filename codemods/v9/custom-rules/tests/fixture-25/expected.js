"use strict";

export default {
  meta: {
    docs: {},
    schema: []
  },
  create: (context) => {
    const contextSourceCode = context.sourceCode ?? context.getSourceCode();
  return {
    Program(node) {
      const source = contextSourceCode.getText(node);
      context.report({
        node,
        message: `Unexpected comma operator in: ${source}`,
        fix(fixer) {
          return fixer.replaceText(node, source);
        },
      });
    },
  };
}
};
