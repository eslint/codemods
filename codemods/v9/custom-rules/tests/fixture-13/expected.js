module.exports = {
  meta: {
    docs: {},
    schema: []
  },
 
    create(context) {
    const contextSourceCode = context.sourceCode ?? context.getSourceCode();
        return {
            Program(node) {
                const scope = contextSourceCode.getScope(node);
                const result = contextSourceCode.markVariableAsUsed("foo", node);
                const statements = (contextSourceCode.getAncestors ? contextSourceCode.getAncestors(node) : context.getAncestors()).filter(node => node.endsWith("Statement"));
            },

            MemberExpression(memberExpressionNode) {
                const ancestor = (contextSourceCode.getAncestors ? contextSourceCode.getAncestors(memberExpressionNode) : context.getAncestors());
            },

            FunctionDeclaration(functionDeclarationNode) {
                const declaredVariables = contextSourceCode.getDeclaredVariables(functionDeclarationNode);
            },
        };
    }
};
