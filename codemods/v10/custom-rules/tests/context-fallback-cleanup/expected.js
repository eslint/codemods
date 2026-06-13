'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        // ?? form (right side deprecated)
        const file = context.filename
        const phys = context.physicalFilename
        const cwd = context.cwd
        const src = context.sourceCode
        // ternary form: context.METHOD ? context.METHOD() : context.PROP
        const file2 = context.filename
        const src2 = context.sourceCode
      },
    }
  },
}
