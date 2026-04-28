module.exports = {
  meta: {
    docs: {},
    schema: []
  },
 
    create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const cwd = context.cwd ?? context.getCwd();
        const filename = context.filename ?? context.getFilename();
        const physicalFilename = context.physicalFilename ?? context.getPhysicalFilename();
        return {
            Program(node) {},
        };
    }
};
