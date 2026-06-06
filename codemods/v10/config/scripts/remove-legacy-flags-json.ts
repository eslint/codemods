import { type Edit, type SgRoot } from 'codemod:ast-grep'
import type JSONLang from 'codemod:ast-grep/langs/json'

import { applyAllTransforms } from './legacy-flag-transforms.ts'

export default async function transform(root: SgRoot<JSONLang>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const node of rootNode.findAll({ rule: { kind: 'string' } })) {
    const nodeText = node.text()
    if (nodeText.length < 2) continue
    const inner = nodeText.slice(1, -1) // JSON strings are always "..."
    const newInner = applyAllTransforms(inner)
    if (newInner !== inner) {
      edits.push(node.replace(`"${newInner}"`))
    }
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
