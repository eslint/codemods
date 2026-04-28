"use strict";

module.exports = {
  meta: {
    docs: {},
    schema: []
  },
  create: function(foo) {
    return {
        Program: function(node) {
            foo.report({
                node: node,
                message: "Unexpected use of comma operator.",
                fix: function() {}
            });
        }
    };
}
};

