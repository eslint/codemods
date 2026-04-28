module.exports = {
  meta: {
    docs: {},
    schema: []
  },
 
    create(context) {
        return {
            Program(node) {
                const sourceCode = context.sourceCode ?? context.getSourceCode();
                const cwd = context.cwd ?? context.getCwd();
                const filename = context.filename ?? context.getFilename();
                const physicalFilename = context.physicalFilename ?? context.getPhysicalFilename();
            },

            FunctionDeclaration(node) {
                const _sourceCode = context.sourceCode ?? context.getSourceCode();
                const _cwd = context.cwd ?? context.getCwd();
                const _filename = context.filename ?? context.getFilename();
                const _physicalFilename = context.physicalFilename ?? context.getPhysicalFilename();
            }
        };
    }
};
