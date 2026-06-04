import { type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

function getSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'pair',
      has: {
        kind: 'property_identifier',
        regex: '^type$',
      },
      not: {
        inside: {
          kind: 'array',
          inside: {
            kind: 'pair',
            has: {
              kind: 'property_identifier',
              regex: '^errors$',
            },
          },
        },
      },
      inside: {
        kind: 'object',
        inside: {
          kind: 'array',
          inside: {
            kind: 'pair',
            has: {
              kind: 'property_identifier',
              regex: '^invalid$',
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
  }
}

function removePairRange(pair: SgNode<JS>, source: string): { start: number; end: number } {
  const r = pair.range()
  const start = r.start.index
  const end = r.end.index

  // Prefer removing the preceding comma so the trailing element keeps its comma
  const before = source.slice(0, start)
  const precedingComma = before.match(/,\s*$/)
  if (precedingComma) {
    return { start: start - precedingComma[0].length, end }
  }

  // First property — remove trailing comma instead
  const after = source.slice(end)
  const trailingComma = after.match(/^\s*,/)
  if (trailingComma) {
    return { start, end: end + trailingComma[0].length }
  }

  return { start, end }
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const pairs = rootNode.findAll(getSelector())

  if (pairs.length === 0) return null

  const source = rootNode.text()
  const deletions = pairs.map((pair) => removePairRange(pair, source)).sort((a, b) => b.start - a.start)

  let result = source
  for (const { start, end } of deletions) {
    result = result.slice(0, start) + result.slice(end)
  }

  return result
}
