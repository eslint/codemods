"use strict";

export default {
  meta: {
    docs: {},
    schema: []
  },
  create: function (context) {
  return {
    Program(node) {
      context.report({
        node,
        message: "Unexpected use of comma operator.",
      });
    },
  };
}
};
