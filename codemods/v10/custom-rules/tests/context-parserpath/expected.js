'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        const parser = context.parserPath /* TODO: context.parserPath removed in ESLint v10, no replacement */
        if (context.parserPath /* TODO: context.parserPath removed in ESLint v10, no replacement */ === 'espree') {
          return
        }
      },
    }
  },
}
