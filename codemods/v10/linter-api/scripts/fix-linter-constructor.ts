import type { Edit, RuleConfig, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const ESLINTRC_TODO = '/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */'
const REMOVED_FLAGS = new Set(['v10_config_lookup_from_file', 'unstable_config_lookup_from_file'])
const DEPRECATED_METHODS = ['defineParser', 'defineRule', 'defineRules', 'getRules']

const linterNewExprSelector = {
  rule: {
    kind: 'new_expression',
    has: { field: 'constructor', regex: '^Linter$' },
  },
} as RuleConfig<JS>

const loadESLintCallSelector = {
  rule: {
    kind: 'call_expression',
    has: { field: 'function', regex: '^loadESLint$' },
  },
} as RuleConfig<JS>

const flagsPairSelector = {
  rule: { kind: 'pair', has: { field: 'key', regex: '^flags$' } },
} as RuleConfig<JS>

function namedChildren(node: SgNode<JS>): SgNode<JS>[] {
  return node.children().filter((c) => c.isNamed())
}

// Reconstruct an object literal from a subset of its named children's source text.
function rebuildObject(children: SgNode<JS>[]): string {
  return `{ ${children.map((n) => n.text()).join(', ')} }`
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  // ── 1–4. new Linter({ configType: 'flat'|'eslintrc' }) ───────────────────────
  for (const newExpr of rootNode.findAll(linterNewExprSelector)) {
    const argsNode = newExpr.find({ rule: { kind: 'arguments' } })
    if (!argsNode) continue
    const argObj = argsNode.find({ rule: { kind: 'object' } })
    if (!argObj) continue

    const configTypePair = argObj.find({
      rule: { kind: 'pair', has: { field: 'key', regex: '^configType$' } },
    })
    if (!configTypePair) continue

    const configTypeVal = configTypePair.find({ rule: { kind: 'string_fragment' } })?.text() ?? ''
    if (configTypeVal !== 'flat' && configTypeVal !== 'eslintrc') continue

    const otherChildren = namedChildren(argObj).filter((n) => n.id() !== configTypePair.id())

    if (configTypeVal === 'flat') {
      if (!otherChildren.length) {
        // new Linter({ configType: 'flat' }) → new Linter()
        edits.push(argsNode.replace('()'))
      } else {
        // new Linter({ configType: 'flat', ...rest }) → new Linter({ ...rest })
        edits.push(argObj.replace(rebuildObject(otherChildren)))
      }
    } else if (!otherChildren.length) {
      // new Linter({ configType: 'eslintrc' }) → new Linter(/* TODO */)
      edits.push(argsNode.replace(`(${ESLINTRC_TODO})`))
    } else {
      // new Linter({ configType: 'eslintrc', ...rest }) → new Linter({ ...rest /* TODO */ })
      edits.push(argObj.replace(`{ ${otherChildren.map((n) => n.text()).join(', ')} ${ESLINTRC_TODO} }`))
    }
  }

  // ── 5–6. loadESLint({ useFlatConfig: true|false }) ───────────────────────────
  for (const callExpr of rootNode.findAll(loadESLintCallSelector)) {
    const argsNode = callExpr.find({ rule: { kind: 'arguments' } })
    if (!argsNode) continue
    const argObj = argsNode.find({ rule: { kind: 'object' } })
    if (!argObj) continue

    const useFlatConfigPair = argObj.find({
      rule: { kind: 'pair', has: { field: 'key', regex: '^useFlatConfig$' } },
    })
    if (!useFlatConfigPair) continue

    const otherChildren = namedChildren(argObj).filter((n) => n.id() !== useFlatConfigPair.id())

    if (!otherChildren.length) {
      // loadESLint({ useFlatConfig: ... }) → loadESLint()
      edits.push(argsNode.replace('()'))
    } else {
      // loadESLint({ useFlatConfig: ..., ...rest }) → loadESLint({ ...rest })
      edits.push(argObj.replace(rebuildObject(otherChildren)))
    }
  }

  // ── 7. flags: [...] — remove removed flag values ─────────────────────────────
  for (const pair of rootNode.findAll(flagsPairSelector)) {
    const arrayNode = pair.find({ rule: { kind: 'array' } })
    if (!arrayNode) continue

    const allElems = namedChildren(arrayNode).filter((e) => e.kind() === 'string')
    const keptElems = allElems.filter(
      (e) => !REMOVED_FLAGS.has(e.find({ rule: { kind: 'string_fragment' } })?.text() ?? ''),
    )

    if (keptElems.length < allElems.length) {
      edits.push(arrayNode.replace(`[${keptElems.map((e) => e.text()).join(', ')}]`))
    }
  }

  // ── 8. Deprecated Linter instance methods → TODO comment ─────────────────────
  for (const method of DEPRECATED_METHODS) {
    for (const callExpr of rootNode.findAll({
      rule: {
        kind: 'call_expression',
        has: {
          field: 'function',
          has: { kind: 'property_identifier', regex: `^${method}$` },
        },
      },
    })) {
      const argsNode = callExpr.find({ rule: { kind: 'arguments' } })
      if (!argsNode) continue
      const insertPos = argsNode.range().start.index + 1 // after '('
      edits.push({
        startPos: insertPos,
        endPos: insertPos,
        insertedText: `/* TODO: ${method}() removed in ESLint v10, no replacement */ `,
      })
    }
  }

  if (!edits.length) return null

  return rootNode.commitEdits(edits)
}
