'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        const file = context.filename ?? context.getFilename()
        const phys = context.physicalFilename ?? context.getPhysicalFilename()
        const cwd = context.cwd ?? context.getCwd()
        const src = context.sourceCode ?? context.getSourceCode()
      },
    }
  },
}
