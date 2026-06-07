import type { Edit, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const RADIX_AS_NEEDED_TODO =
  '/* TODO: "as-needed" is removed in ESLint v10 — remove the "as-needed" option or disable the rule */'

// Named (non-punctuation) children of a node
function namedChildren(node: SgNode<JS>): SgNode<JS>[] {
  return node.children().filter((c) => c.isNamed())
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  // ── 1. func-names: Remove extra 4th string element ──────────────────────────
  // ESLint v10 no longer accepts [severity, mode, options, extraMode]; strip extraMode.
  for (const pair of rootNode.findAll({
    rule: { kind: 'pair', has: { field: 'key', regex: 'func-names' } },
  })) {
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

    const { start, end } = arrayNode.range()
    edits.push({
      startPos: start.index,
      endPos: end.index,
      insertedText: `${arrayText.slice(0, arrayText.length - match[0].length)}]`,
    })
  }

  // ── 2. no-invalid-regexp: Deduplicate allowConstructorFlags values ────────────
  // ESLint v10 rejects duplicate flags; keep only the first occurrence of each.
  for (const pair of rootNode.findAll({
    rule: { kind: 'pair', has: { field: 'key', regex: 'allowConstructorFlags' } },
  })) {
    const arrayNode = pair.find({ rule: { kind: 'array' } })
    if (!arrayNode) continue

    const stringElems = namedChildren(arrayNode).filter((e) => e.kind() === 'string')
    const seen = new Set<string>()
    const uniqueElems: SgNode<JS>[] = []
    for (const elem of stringElems) {
      const flag = elem.text().replaceAll(/['"` ]/g, '')
      if (!seen.has(flag)) {
        seen.add(flag)
        uniqueElems.push(elem)
      }
    }

    if (uniqueElems.length < stringElems.length) {
      const { start, end } = arrayNode.range()
      edits.push({
        startPos: start.index,
        endPos: end.index,
        insertedText: `[${uniqueElems.map((e) => e.text()).join(', ')}]`,
      })
    }
  }

  // ── 3. radix: Handle deprecated 'always' and 'as-needed' options ─────────────
  for (const pair of rootNode.findAll({
    rule: { kind: 'pair', has: { field: 'key', regex: 'radix' } },
  })) {
    const arrayNode = pair.find({ rule: { kind: 'array' } })
    if (!arrayNode) continue

    const elems = namedChildren(arrayNode)
    const severity = elems[0]
    const option = elems[1]
    if (!severity || option?.kind() !== 'string') continue

    const optionVal = option.text().replaceAll(/['"` ]/g, '')

    if (optionVal === 'always') {
      // ['error', 'always'] → 'error'  (strip redundant option; 'always' is the only v10 behavior)
      const { start, end } = arrayNode.range()
      edits.push({ startPos: start.index, endPos: end.index, insertedText: severity.text() })
    } else if (optionVal === 'as-needed') {
      // ['error', 'as-needed'] → ['error', /* TODO */ 'as-needed']
      const insertPos = option.range().start.index
      edits.push({ startPos: insertPos, endPos: insertPos, insertedText: `${RADIX_AS_NEEDED_TODO} ` })
    }
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
