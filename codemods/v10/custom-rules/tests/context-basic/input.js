'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        const file = context.getFilename()
        const phys = context.getPhysicalFilename()
        const cwd = context.getCwd()
        const src = context.getSourceCode()
        const opts = context.parserOptions
      },
    }
  },
}
