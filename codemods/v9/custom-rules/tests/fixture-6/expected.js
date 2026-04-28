"use strict";

module.exports = {
  meta: {
    docs: {},
    schema: [
    SCHEMA_STUFF
]
  },
  create: function(context) {
    return {
        Program: function(node) {
            context.report({
                node: node,
                message: "Unexpected use of comma operator."
            });
        }
    };
}
};

var SCHEMA_STUFF = {
    enum: ["foo", "bar"]
};

