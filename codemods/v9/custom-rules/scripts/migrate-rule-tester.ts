import type { Edit, RuleConfig, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const FLAT_RULE_TESTER_SELECTOR = {
  rule: {
    kind: 'identifier',
    regex: '^FlatRuleTester$',
  },
} as const satisfies RuleConfig<JS>

const PARSER_OPTIONS_PAIR_SELECTOR = {
  rule: {
    kind: 'pair',
    has: {
      kind: 'property_identifier',
      regex: '^parserOptions$',
    },
    inside: {
      kind: 'object',
      inside: {
        kind: 'array',
        inside: {
          kind: 'pair',
          has: {
            any: [{ kind: 'property_identifier', regex: '^(?:valid|invalid)$' }],
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

const OUTPUT_EQUALS_CODE_SELECTOR = {
  rule: {
    kind: 'pair',
    has: {
      kind: 'property_identifier',
      regex: '^output$',
    },
    inside: {
      kind: 'object',
      has: {
        kind: 'pair',
        has: {
          kind: 'property_identifier',
          regex: '^code$',
        },
      },
      inside: {
        kind: 'array',
        inside: {
          kind: 'pair',
          has: {
            any: [{ kind: 'property_identifier', regex: '^(?:valid|invalid)$' }],
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

const getStringFragment = (node: SgNode<JS>): string | null =>
  node.find({ rule: { kind: 'string_fragment' } })?.text() ?? null

const removePairEdit = (pair: SgNode<JS>, source: string): Edit => {
  const range = pair.range()
  const start = range.start.index
  const end = range.end.index
  const before = source.slice(0, start)
  const precedingComma = before.match(/,\s*$/)

  if (precedingComma) {
    return {
      startPos: start - precedingComma[0].length,
      endPos: end,
      insertedText: '',
    }
  }

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
  const edits: Edit[] = []
  const source = rootNode.text()

  for (const identifier of rootNode.findAll(FLAT_RULE_TESTER_SELECTOR)) {
    edits.push(identifier.replace('RuleTester'))
  }

  for (const binding of rootNode.findAll({
    rule: {
      any: [
        { kind: 'import_specifier', regex: '^FlatRuleTester$' },
        { kind: 'shorthand_property_identifier', regex: '^FlatRuleTester$' },
        { kind: 'shorthand_property_identifier_pattern', regex: '^FlatRuleTester$' },
      ],
    },
  })) {
    edits.push(binding.replace('RuleTester'))
  }

  for (const pair of rootNode.findAll(PARSER_OPTIONS_PAIR_SELECTOR)) {
    const key = pair.child(0)
    if (key) {
      edits.push(key.replace('languageOptions'))
    }
  }

  for (const outputPair of rootNode.findAll(OUTPUT_EQUALS_CODE_SELECTOR)) {
    const testObject = outputPair.parent()?.parent()
    const codePair = testObject?.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'property_identifier',
          regex: '^code$',
        },
      },
    })

    const outputValue = outputPair.child(1)
    const codeValue = codePair?.child(1)
    if (!outputValue || !codeValue) {
      continue
    }

    const outputText = getStringFragment(outputValue) ?? outputValue.text()
    const codeText = getStringFragment(codeValue) ?? codeValue.text()

    if (outputText === codeText) {
      edits.push(removePairEdit(outputPair, source))
    }
  }

  if (edits.length === 0) {
    return null
  }

  return rootNode.commitEdits(edits)
}
