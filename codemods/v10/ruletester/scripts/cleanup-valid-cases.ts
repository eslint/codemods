import { type Edit, type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// Properties that v10 throws on when present in a valid test case
const PROPS_TO_REMOVE = ['errors', 'output']

const selector = {
  rule: {
    kind: 'pair',
    has: {
      kind: 'property_identifier',
      regex: `^(?:${PROPS_TO_REMOVE.join('|')})$`,
    },
    inside: {
      kind: 'object',
      inside: {
        kind: 'array',
        inside: {
          kind: 'pair',
          has: {
            kind: 'property_identifier',
            regex: '^valid$',
          },
          inside: {
            kind: 'object',
            inside: {
              kind: 'arguments',
              inside: {
                kind: 'call_expression',
                has: {
                  kind: 'member_expression',
                  has: {
                    kind: 'property_identifier',
                    regex: '^run$',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const satisfies RuleConfig<JS>

function removePairEdit(pair: SgNode<JS>, source: string): Edit {
  const range = pair.range()
  const start = range.start.index
  const end = range.end.index

  // Prefer removing the preceding comma so the trailing element keeps its comma
  const before = source.slice(0, start)
  const precedingComma = before.match(/,\s*$/)

  if (precedingComma) {
    return {
      startPos: start - precedingComma[0].length,
      endPos: end,
      insertedText: '',
    }
  }

  // First property — remove trailing comma instead
  const after = source.slice(end)
  const trailingComma = after.match(/^\s*,\s*/)

  if (trailingComma) {
    return {
      startPos: start,
      endPos: end + trailingComma[0].length,
      insertedText: '',
    }
  }

  return {
    startPos: start,
    endPos: end,
    insertedText: '',
  }
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const pairs = rootNode.findAll(selector)

  if (pairs.length === 0) return null

  const source = rootNode.text()
  const edits = pairs.map((pair) => removePairEdit(pair, source))

  return rootNode.commitEdits(edits)
}
