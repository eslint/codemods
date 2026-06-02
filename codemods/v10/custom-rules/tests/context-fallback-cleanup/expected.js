'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        const file = context.filename
        const phys = context.physicalFilename
        const cwd = context.cwd
        const src = context.sourceCode
      },
    }
  },
}
