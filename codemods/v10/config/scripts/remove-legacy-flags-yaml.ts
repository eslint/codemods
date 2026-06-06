import { type Edit, type SgRoot } from 'codemod:ast-grep'
import type YAMLLang from 'codemod:ast-grep/langs/yaml'

import { applyAllTransforms } from './legacy-flag-transforms.ts'

export default async function transform(root: SgRoot<YAMLLang>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  // Double-quoted scalars: "value"
  for (const node of rootNode.findAll({ rule: { kind: 'double_quote_scalar' } })) {
    const nodeText = node.text()
    if (nodeText.length < 2) continue
    const inner = nodeText.slice(1, -1)
    const newInner = applyAllTransforms(inner)
    if (newInner !== inner) {
      edits.push(node.replace(`"${newInner}"`))
    }
  }

  // Single-quoted scalars: 'value'
  for (const node of rootNode.findAll({ rule: { kind: 'single_quote_scalar' } })) {
    const nodeText = node.text()
    if (nodeText.length < 2) continue
    const inner = nodeText.slice(1, -1)
    const newInner = applyAllTransforms(inner)
    if (newInner !== inner) {
      edits.push(node.replace(`'${newInner}'`))
    }
  }

  // Unquoted string scalars (leaf node inside plain_scalar)
  for (const node of rootNode.findAll({ rule: { kind: 'string_scalar' } })) {
    const nodeText = node.text()
    const newText = applyAllTransforms(nodeText)
    if (newText !== nodeText) {
      edits.push(node.replace(newText))
    }
  }

  // Block scalars (| or > style multi-line strings)
  // The | or > header is preserved because our regexes don't match it.
  for (const node of rootNode.findAll({ rule: { kind: 'block_scalar' } })) {
    const nodeText = node.text()
    const newText = applyAllTransforms(nodeText)
    if (newText !== nodeText) {
      edits.push(node.replace(newText))
    }
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
