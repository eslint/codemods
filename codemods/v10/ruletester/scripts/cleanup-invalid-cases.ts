import { type Edit, type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// ESLint v9 (flat-config mode) throws ConfigError when an invalid test case
// carries a top-level `type` property, e.g.
//
//   { type: 'CallExpression', code: 'eval(x)', errors: [...] }
//
// This selector keys on `code` being a sibling property so it naturally
// excludes error-matcher objects inside errors[] (those don't have `code`).
//
// Two forms of test-case object are supported:
//   1. Direct array member: invalid: [{ type, code: 'str', errors }]
//      The `code` property is a full `pair` node: code: 'str'.
//
//   2. Arrow-function spread: invalid: [...arr.map(code => ({ type, code, errors }))]
//      The `code` property is a shorthand_property_identifier node.
//
// The discriminating `has` constraint therefore accepts either form.

// Shared anchor: once we've found the `pair(invalid:)`, the ancestor chain
// up to the `.run()` call is the same for both code-paths.
const invalidPairAnchor = {
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
} as const

// Path A — test-case object directly in the `invalid: [...]` array.
//   pair(type) → object → array → pair(invalid) → …
const directArrayPath = {
  kind: 'array',
  inside: invalidPairAnchor,
} as const

// Path B — test-case object is the parenthesized body of an arrow function
// spread into the `invalid: [...]` array, e.g.:
//   ...arr.map((code) => ({ type, code, errors }))
//
//   pair(type) → object → parenthesized_expression → arrow_function →
//   arguments → call_expression(.map) → spread_element →
//   array → pair(invalid) → …
const mapSpreadPath = {
  kind: 'parenthesized_expression',
  inside: {
    kind: 'arrow_function',
    inside: {
      kind: 'arguments',
      inside: {
        kind: 'call_expression',
        inside: {
          kind: 'spread_element',
          inside: {
            kind: 'array',
            inside: invalidPairAnchor,
          },
        },
      },
    },
  },
} as const

const selector = {
  rule: {
    kind: 'pair',
    has: {
      kind: 'property_identifier',
      regex: '^type$',
    },
    inside: {
      kind: 'object',
      // Discriminator: every invalid test-case object has a `code` property.
      // Error-matcher objects inside errors[] do not — this naturally excludes them.
      // Accept both full pair (`code: 'str'`) and shorthand (`code`) forms.
      has: {
        any: [
          { kind: 'pair', has: { kind: 'property_identifier', regex: '^code$' } },
          { kind: 'shorthand_property_identifier', regex: '^code$' },
        ],
      },
      inside: {
        any: [directArrayPath, mapSpreadPath],
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
