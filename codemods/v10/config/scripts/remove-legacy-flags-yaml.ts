import { type Edit, type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type YAMLLang from 'codemod:ast-grep/langs/yaml'

import { applyAllTransforms } from './legacy-flag-transforms.ts'

const runKeyPairSelector = {
  rule: {
    kind: 'block_mapping_pair',
    has: {
      kind: 'flow_node',
      has: {
        kind: 'plain_scalar',
        regex: '^run$',
      },
    },
  },
} as const satisfies RuleConfig<YAMLLang>

const valueScalarSelector = {
  rule: {
    any: [
      { kind: 'plain_scalar' },
      { kind: 'string_scalar' },
      { kind: 'single_quote_scalar' },
      { kind: 'double_quote_scalar' },
      { kind: 'block_scalar' },
    ],
    not: {
      regex: '^run$',
    },
  },
} as const satisfies RuleConfig<YAMLLang>

function transformScalar(node: SgNode<YAMLLang>): Edit | null {
  const kind = node.kind()
  const nodeText = node.text()

  if (kind === 'double_quote_scalar') {
    if (nodeText.length < 2) return null
    const inner = nodeText.slice(1, -1)
    const newInner = applyAllTransforms(inner)
    return newInner !== inner ? node.replace(`"${newInner}"`) : null
  }

  if (kind === 'single_quote_scalar') {
    if (nodeText.length < 2) return null
    const inner = nodeText.slice(1, -1)
    const newInner = applyAllTransforms(inner)
    return newInner !== inner ? node.replace(`'${newInner}'`) : null
  }

  const newText = applyAllTransforms(nodeText)
  return newText !== nodeText ? node.replace(newText) : null
}

export default async function transform(root: SgRoot<YAMLLang>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const pair of rootNode.findAll(runKeyPairSelector)) {
    for (const scalar of pair.findAll(valueScalarSelector)) {
      const edit = transformScalar(scalar)
      if (edit !== null) edits.push(edit)
    }
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
