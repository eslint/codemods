'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        // ?? form (right side deprecated)
        const file = context.filename ?? context.getFilename()
        const phys = context.physicalFilename ?? context.getPhysicalFilename()
        const cwd = context.cwd ?? context.getCwd()
        const src = context.sourceCode ?? context.getSourceCode()
        // ternary form: context.METHOD ? context.METHOD() : context.PROP
        const file2 = context.getFilename ? context.getFilename() : context.filename
        const src2 = context.getSourceCode ? context.getSourceCode() : context.sourceCode
      },
    }
  },
}
