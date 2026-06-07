// No eslint import — nodeType here belongs to an unrelated domain, should not be changed
const astNode = {
  type: 'Identifier',
  nodeType: 'VariableDeclaration',
  name: 'x',
}

function inspect(node) {
  return node.nodeType
}
