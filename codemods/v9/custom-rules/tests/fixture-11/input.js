module.exports = {
    create(context) {
        const sourceCode = context.getSourceCode();
        const cwd = context.getCwd();
        const filename = context.getFilename();
        const physicalFilename = context.getPhysicalFilename();
        return {
            Program(node) {},
        };
    }
};
