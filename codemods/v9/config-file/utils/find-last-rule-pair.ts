import type { SgNode } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'
import type JSONLang from 'codemod:ast-grep/langs/json'

const jsRulesObjectPairInside = {
  kind: 'object',
  inside: {
    kind: 'pair',
    has: {
      kind: 'property_identifier',
      pattern: '$IDENTIFIER',
    },
  },
} as const

const jsonRulesObjectPairInside = {
  kind: 'object',
  inside: {
    kind: 'pair',
    has: {
      kind: 'string',
      pattern: '$IDENTIFIER',
    },
  },
} as const

export const findLastJsRulePair = (
  sector: SgNode<JS>,
  ruleName: string,
  options?: { unquotedKey?: boolean },
): SgNode<JS> | null => {
  const keyMatchers: Array<Record<string, unknown>> = [
    {
      kind: 'string',
      any: [{ pattern: `'${ruleName}'` }, { pattern: `"${ruleName}"` }],
    },
  ]

  if (options?.unquotedKey) {
    keyMatchers.push({
      kind: 'property_identifier',
      regex: `^${ruleName}$`,
    })
  }

  const pairs = sector.findAll({
    rule: {
      kind: 'pair',
      has: {
        any: keyMatchers,
      },
      inside: jsRulesObjectPairInside,
    },
  })

  return pairs.at(-1) ?? null
}

export const findLastJsonRulePair = (sector: SgNode<JSONLang>, ruleName: string): SgNode<JSONLang> | null => {
  const pairs = sector.findAll({
    rule: {
      kind: 'pair',
      has: {
        kind: 'string',
        pattern: `"${ruleName}"`,
      },
      inside: jsonRulesObjectPairInside,
    },
  })

  return pairs.at(-1) ?? null
}
