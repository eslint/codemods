module.exports = {
    create(context) {
        return {
            Program(node) {
                const sourceCode = context.getSourceCode();
                const cwd = context.getCwd();
                const filename = context.getFilename();
                const physicalFilename = context.getPhysicalFilename();
            },

            FunctionDeclaration(node) {
                const _sourceCode = context.getSourceCode();
                const _cwd = context.getCwd();
                const _filename = context.getFilename();
                const _physicalFilename = context.getPhysicalFilename();
            }
        };
    }
};
