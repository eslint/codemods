import { type Edit, type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// LintMessage.nodeType was removed in ESLint v10.
// 1. Remove `nodeType: <value>` property pairs from object literals.
// 2. Flag `.nodeType` member expression accesses with a TODO comment.
const selector = {
  rule: {
    kind: 'pair',
    has: {
      kind: 'property_identifier',
      regex: '^nodeType$',
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

  // First property — remove trailing comma and the leading newline+indent to avoid a blank line
  const after = source.slice(end)
  const trailingComma = after.match(/^\s*,/)

  if (trailingComma) {
    const leadingNewlineAndIndent = before.match(/\n[ \t]*$/)
    const adjustedStart = leadingNewlineAndIndent ? start - leadingNewlineAndIndent[0].length : start
    return {
      startPos: adjustedStart,
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

// .nodeType member access on any object — flag with TODO for manual removal
const NODETYPE_MEMBER_RE = /\.nodeType\b/g

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const pairs = rootNode.findAll(selector)

  const source = rootNode.text()

  // 1. Remove nodeType: <value> object property pairs
  let result = pairs.length > 0 ? rootNode.commitEdits(pairs.map((pair) => removePairEdit(pair, source))) : source

  // 2. Flag remaining .nodeType member accesses with a TODO
  result = result.replaceAll(
    NODETYPE_MEMBER_RE,
    '.nodeType /* TODO: LintMessage.nodeType was removed in ESLint v10 — remove this usage */',
  )

  return result === source ? null : result
}
