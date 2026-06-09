import { type Edit, type RuleConfig, type SgRoot } from 'codemod:ast-grep'
import type JSONLang from 'codemod:ast-grep/langs/json'

import { applyAllTransforms } from './legacy-flag-transforms.ts'

const selector = {
  rule: {
    kind: 'string',
    inside: {
      kind: 'pair',
      inside: {
        kind: 'object',
        inside: {
          kind: 'pair',
          has: {
            kind: 'string',
            regex: '^"scripts"$',
          },
        },
      },
    },
  },
} as const satisfies RuleConfig<JSONLang>

export default async function transform(root: SgRoot<JSONLang>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const node of rootNode.findAll(selector)) {
    const nodeText = node.text()
    if (nodeText.length < 2) continue
    const inner = nodeText.slice(1, -1)
    const newInner = applyAllTransforms(inner)
    if (newInner !== inner) {
      edits.push(node.replace(`"${newInner}"`))
    }
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
