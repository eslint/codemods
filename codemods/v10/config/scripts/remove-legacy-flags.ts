import { type Edit, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

import { applyAllTransforms } from './legacy-flag-transforms.ts'

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const node of rootNode.findAll({ rule: { kind: 'string' } })) {
    const nodeText = node.text()
    if (nodeText.length < 2) continue
    const quote = nodeText[0] // ' or "
    const inner = nodeText.slice(1, -1)
    const newInner = applyAllTransforms(inner)
    if (newInner !== inner) {
      edits.push(node.replace(`${quote}${newInner}${quote}`))
    }
  }

  // Template strings without ${...} interpolations (e.g. YAML/JSON content embedded as JS strings)
  for (const node of rootNode.findAll({ rule: { kind: 'template_string' } })) {
    if (node.find({ rule: { kind: 'template_substitution' } })) continue
    const nodeText = node.text()
    if (nodeText.length < 2) continue
    const inner = nodeText.slice(1, -1) // strip backticks
    const newInner = applyAllTransforms(inner)
    if (newInner !== inner) {
      edits.push(node.replace(`\`${newInner}\``))
    }
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
