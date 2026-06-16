"use strict";

export default (context) => {
  return {
    Program(node) {
      const source = context.getSource(node);
      context.report({
        node,
        message: `Unexpected comma operator in: ${source}`,
        fix(fixer) {
          return fixer.replaceText(node, source);
        },
      });
    },
  };
};
