import { type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// LintMessage.nodeType was removed in ESLint v10.
// 1. Remove `nodeType: <value>` property pairs from object literals.
// 2. Flag `.nodeType` member expression accesses with a TODO comment.
function getSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'pair',
      has: {
        kind: 'property_identifier',
        regex: '^nodeType$',
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

  // First property — remove trailing comma and the leading newline+indent to avoid a blank line
  const after = source.slice(end)
  const trailingComma = after.match(/^\s*,/)
  if (trailingComma) {
    const leadingNewlineAndIndent = before.match(/\n[ \t]*$/)
    const adjustedStart = leadingNewlineAndIndent ? start - leadingNewlineAndIndent[0].length : start
    return { start: adjustedStart, end: end + trailingComma[0].length }
  }

  return { start, end }
}

// .nodeType member access on any object — flag with TODO for manual removal
const NODETYPE_MEMBER_RE = /\.nodeType\b/g

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const pairs = rootNode.findAll(getSelector())

  const source = rootNode.text()
  let result = source

  // 1. Remove nodeType: <value> object property pairs
  if (pairs.length > 0) {
    const deletions = pairs.map((pair) => removePairRange(pair, source)).sort((a, b) => b.start - a.start)

    for (const { start, end } of deletions) {
      result = result.slice(0, start) + result.slice(end)
    }
  }

  // 2. Flag remaining .nodeType member accesses with a TODO
  result = result.replaceAll(
    NODETYPE_MEMBER_RE,
    '.nodeType /* TODO: LintMessage.nodeType was removed in ESLint v10 — remove this usage */',
  )

  return result === source ? null : result
}
