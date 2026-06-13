import type { Edit, RuleConfig, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const RADIX_AS_NEEDED_TODO =
  '/* TODO: "as-needed" is removed in ESLint v10 — remove the "as-needed" option or disable the rule */'

const funcNamesPairSelector = {
  rule: { kind: 'pair', has: { field: 'key', regex: 'func-names' } },
} as RuleConfig<JS>

const allowConstructorFlagsPairSelector = {
  rule: { kind: 'pair', has: { field: 'key', regex: 'allowConstructorFlags' } },
} as RuleConfig<JS>

const radixPairSelector = {
  rule: { kind: 'pair', has: { field: 'key', regex: 'radix' } },
} as RuleConfig<JS>

// Named (non-punctuation) children of a node
function namedChildren(node: SgNode<JS>): SgNode<JS>[] {
  return node.children().filter((c) => c.isNamed())
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  // ── 1. func-names: Remove extra 4th string element ──────────────────────────
  // ESLint v10 no longer accepts [severity, mode, options, extraMode]; strip extraMode.
  for (const pair of rootNode.findAll(funcNamesPairSelector)) {
    const arrayNode = pair.find({ rule: { kind: 'array' } })
    if (!arrayNode) continue

    const elems = namedChildren(arrayNode)
    // Must have at least 4 elements, and the 3rd (index 2) must be the options object
    if (elems.length < 4 || elems[2]?.kind() !== 'object') continue

    // Remove the trailing string element from the local array text to avoid
    // navigating tree-sitter sibling commas
    const arrayText = arrayNode.text()
    const trailingStringRe = /,\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*\]$/
    const match = arrayText.match(trailingStringRe)
    if (!match) continue

    edits.push(arrayNode.replace(`${arrayText.slice(0, arrayText.length - match[0].length)}]`))
  }

  // ── 2. no-invalid-regexp: Deduplicate allowConstructorFlags values ────────────
  // ESLint v10 rejects duplicate flags; keep only the first occurrence of each.
  for (const pair of rootNode.findAll(allowConstructorFlagsPairSelector)) {
    const arrayNode = pair.find({ rule: { kind: 'array' } })
    if (!arrayNode) continue

    const allFragments = arrayNode.findAll({ rule: { kind: 'string_fragment' } })
    const seen = new Set<string>()
    const uniqueFragments: SgNode<JS>[] = []
    for (const frag of allFragments) {
      if (!seen.has(frag.text())) {
        seen.add(frag.text())
        uniqueFragments.push(frag)
      }
    }

    if (uniqueFragments.length < allFragments.length) {
      edits.push(arrayNode.replace(`[${uniqueFragments.map((f) => f.parent()?.text() ?? '').join(', ')}]`))
    }
  }

  // ── 3. radix: Handle deprecated 'always' and 'as-needed' options ─────────────
  for (const pair of rootNode.findAll(radixPairSelector)) {
    const arrayNode = pair.find({ rule: { kind: 'array' } })
    if (!arrayNode) continue

    const elems = namedChildren(arrayNode)
    const severity = elems[0]
    const option = elems[1]
    if (!severity || !option?.is('string')) continue

    const optionVal = option.find({ rule: { kind: 'string_fragment' } })?.text() ?? ''

    if (optionVal === 'always') {
      // ['error', 'always'] → 'error'  (strip redundant option; 'always' is the only v10 behavior)
      edits.push(arrayNode.replace(severity.text()))
    } else if (optionVal === 'as-needed') {
      // ['error', 'as-needed'] → ['error', /* TODO */ 'as-needed']
      const insertPos = option.range().start.index
      edits.push({ startPos: insertPos, endPos: insertPos, insertedText: `${RADIX_AS_NEEDED_TODO} ` })
    }
  }

  if (!edits.length) return null

  return rootNode.commitEdits(edits)
}
