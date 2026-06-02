'use strict'

module.exports = {
  create(context) {
    return {
      Program() {
        const parser = context.parserPath
        if (context.parserPath === 'espree') {
          return
        }
      },
    }
  },
}
