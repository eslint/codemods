"use strict";

export default function (context) {
  return {
    Program(node) {
      context.report({
        node,
        message: "Unexpected use of comma operator.",
      });
    },
  };
}
