import { Linter } from 'eslint'

const linter = new Linter()

// This is an AST node from a custom parser — unrelated to LintMessage.
// nodeType here should NOT be removed because the object has no LintMessage
// sibling properties and is not used alongside a verify() result.
const astNode = {
  type: 'Identifier',
  nodeType: 'VariableDeclaration',
  name: 'x',
}

// Also not inside a call with a verify() sibling
function buildNode(nodeType) {
  return { nodeType, value: 42 }
}
