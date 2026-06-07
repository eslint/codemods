import type { Edit, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// LintMessage.nodeType was removed in ESLint v10.
// 1. Remove `nodeType: <value>` property pairs from object literals that can be
//    resolved as LintMessage objects (from eslint's verify/verifyAndFix).
// 2. Flag `.nodeType` member expression accesses with a TODO comment.

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

// Check whether a `nodeType` pair lives inside an object that can be identified
// as an ESLint LintMessage via:
//  1. Sibling LintMessage properties in the same object (fast path, no semantic needed)
//  2. definition() resolution of a sibling call argument to verify/verifyAndFix
//  3. Subscript-expression heuristic (fallback when semantic provider is unavailable)
function isInLintMessageContext(pair: SgNode<JS>): boolean {
  const parentObj = pair.parent()
  if (parentObj?.kind() !== 'object') return false

  // ── Check 1: parent object has a sibling property that only LintMessage carries ──
  if (
    parentObj.find({
      rule: {
        kind: 'pair',
        has: {
          field: 'key',
          regex: 'ruleId|message|line|column|endLine|endColumn|fix|suggestions|source',
        },
      },
    })
  )
    return true

  // ── Check 2 & 3: resolve via the containing call expression ──────────────────
  // Walk up through any intermediate array wrapper to reach the `arguments` node
  let argNode: SgNode<JS> = parentObj
  let cursor: SgNode<JS> | null = parentObj.parent()
  while (cursor?.kind() === 'array') {
    argNode = cursor
    cursor = cursor.parent()
  }
  if (cursor?.kind() !== 'arguments') return false

  for (const sibling of cursor.children()) {
    if (!sibling.isNamed() || sibling.id() === argNode.id()) continue

    // Check 2: try definition() to trace the sibling back to verify/verifyAndFix
    for (const id of [sibling, ...sibling.findAll({ rule: { kind: 'identifier' } })]) {
      if (id.kind() !== 'identifier') continue
      // Guard: definition() requires a semantic provider — not always available
      if (typeof id.definition !== 'function') break

      const def = id.definition({ resolveExternal: false })
      if (def?.kind !== 'local') continue

      const declarator = def.node.parent()
      if (declarator?.kind() !== 'variable_declarator') continue

      if (
        declarator.find({
          rule: {
            kind: 'call_expression',
            has: {
              field: 'function',
              has: { kind: 'property_identifier', regex: '^verify(AndFix)?$' },
            },
          },
        })
      )
        return true
    }

    // Check 3: fallback — sibling is or contains a subscript_expression (messages[N])
    // Combined with the file-level eslint import guard this is a strong enough signal
    if (sibling.kind() === 'subscript_expression' || sibling.find({ rule: { kind: 'subscript_expression' } }))
      return true
  }

  return false
}

// .nodeType member access on any object — flag with TODO for manual removal
const NODETYPE_MEMBER_RE = /\.nodeType\b/g

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const source = rootNode.text()

  // Guard: only process files that import from eslint to avoid touching unrelated
  // objects that happen to have a nodeType property
  const hasEslintImport =
    /from\s+['"]eslint['"]/m.test(source) ||
    /require\s*\(\s*['"]eslint['"]\s*\)/m.test(source) ||
    /import\s*\(\s*['"]eslint['"]\s*\)/m.test(source)
  if (!hasEslintImport) return null

  const allPairs = rootNode.findAll({
    rule: {
      kind: 'pair',
      has: {
        kind: 'property_identifier',
        regex: '^nodeType$',
      },
    },
  })

  // Keep only pairs whose parent object can be identified as a LintMessage
  const pairs = allPairs.filter(isInLintMessageContext)

  // 1. Remove nodeType: <value> object property pairs
  let result = pairs.length > 0 ? rootNode.commitEdits(pairs.map((pair) => removePairEdit(pair, source))) : source

  // 2. Flag remaining .nodeType member accesses with a TODO
  result = result.replaceAll(
    NODETYPE_MEMBER_RE,
    '.nodeType /* TODO: LintMessage.nodeType was removed in ESLint v10 — remove this usage */',
  )

  return result === source ? null : result
}
