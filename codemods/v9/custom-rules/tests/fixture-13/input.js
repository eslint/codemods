module.exports = {
    create(context) {
        return {
            Program(node) {
                const scope = context.getScope();
                const result = context.markVariableAsUsed("foo");
                const statements = context.getAncestors().filter(node => node.endsWith("Statement"));
            },

            MemberExpression(memberExpressionNode) {
                const ancestor = context.getAncestors();
            },

            FunctionDeclaration(functionDeclarationNode) {
                const declaredVariables = context.getDeclaredVariables();
            },
        };
    }
};
