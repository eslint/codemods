import type { Edit, RuleConfig, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const FLAT_ESLINT_SELECTOR = {
  rule: {
    kind: 'identifier',
    regex: '^FlatESLint$',
  },
} as const satisfies RuleConfig<JS>

const LINTER_VERIFY_SELECTOR = {
  rule: {
    kind: 'call_expression',
    has: {
      field: 'function',
      has: {
        kind: 'property_identifier',
        regex: '^(verify|verifyAndFix)$',
      },
    },
  },
} as const satisfies RuleConfig<JS>

const DEPRECATED_LINTER_METHODS = ['defineParser', 'defineRule', 'defineRules', 'getRules']

const namedChildren = (node: SgNode<JS>): SgNode<JS>[] => node.children().filter((child) => child.isNamed())

const rebuildObject = (children: SgNode<JS>[]): string => `{ ${children.map((child) => child.text()).join(', ')} }`

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const identifier of rootNode.findAll(FLAT_ESLINT_SELECTOR)) {
    edits.push(identifier.replace('ESLint'))
  }

  for (const binding of rootNode.findAll({
    rule: {
      any: [
        { kind: 'import_specifier', regex: '^FlatESLint$' },
        { kind: 'shorthand_property_identifier', regex: '^FlatESLint$' },
        { kind: 'shorthand_property_identifier_pattern', regex: '^FlatESLint$' },
      ],
    },
  })) {
    edits.push(binding.replace('ESLint'))
  }

  for (const call of rootNode.findAll(LINTER_VERIFY_SELECTOR)) {
    const argsNode = call.find({ rule: { kind: 'arguments' } })
    const configObject = argsNode?.find({ rule: { kind: 'object' } })
    if (!configObject) {
      continue
    }

    const parserOptionsPair = configObject.find({
      rule: {
        kind: 'pair',
        has: {
          field: 'key',
          regex: '^parserOptions$',
        },
      },
    })

    if (!parserOptionsPair) {
      continue
    }

    const languageOptionsPair = configObject.find({
      rule: {
        kind: 'pair',
        has: {
          field: 'key',
          regex: '^languageOptions$',
        },
      },
    })

    if (languageOptionsPair) {
      const languageOptionsObject = languageOptionsPair.find({ rule: { kind: 'object' } })
      const parserOptionsObject = parserOptionsPair.find({ rule: { kind: 'object' } })
      if (languageOptionsObject && parserOptionsObject) {
        edits.push(
          languageOptionsObject.replace(
            rebuildObject([...namedChildren(languageOptionsObject), ...namedChildren(parserOptionsObject)]),
          ),
        )
        edits.push(parserOptionsPair.replace(''))
      }
    } else {
      const keyNode = parserOptionsPair.child(0)
      if (keyNode) {
        edits.push(keyNode.replace('languageOptions'))
      }
    }
  }

  for (const method of DEPRECATED_LINTER_METHODS) {
    for (const call of rootNode.findAll({
      rule: {
        kind: 'call_expression',
        has: {
          field: 'function',
          has: {
            kind: 'property_identifier',
            regex: `^${method}$`,
          },
        },
      },
    })) {
      const argsNode = call.find({ rule: { kind: 'arguments' } })
      if (!argsNode) {
        continue
      }

      const insertPos = argsNode.range().start.index + 1
      edits.push({
        startPos: insertPos,
        endPos: insertPos,
        insertedText: `/* TODO: ${method}() removed in ESLint v9 flat config mode */ `,
      })
    }
  }

  if (edits.length === 0) {
    return null
  }

  return rootNode.commitEdits(edits)
}
