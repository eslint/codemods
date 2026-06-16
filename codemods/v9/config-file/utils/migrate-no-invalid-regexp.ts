import { parse } from 'codemod:ast-grep'
import type { SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const RULE_VALUE_PREFIX = 'const __eslintRule = '

type ParsedRuleValue = {
  root: SgNode<JS>
  source: string
}

const parseRuleValue = (ruleValue: string): ParsedRuleValue | null => {
  try {
    const root = parse('javascript', `${RULE_VALUE_PREFIX}${ruleValue};`) as unknown as SgRoot<JS>
    return {
      root: root.root(),
      source: ruleValue,
    }
  } catch {
    return null
  }
}

const unwrapRuleValue = (source: string): string => source.slice(RULE_VALUE_PREFIX.length).replace(/;$/, '')

const getTopLevelRuleArray = (root: SgNode<JS>): SgNode<JS> | null =>
  root.find({
    rule: {
      kind: 'array',
      inside: {
        kind: 'variable_declarator',
      },
    },
  })

const getDirectArrayElements = (arrayNode: SgNode<JS>): SgNode<JS>[] =>
  arrayNode.children().filter((child) => child.kind() !== '[' && child.kind() !== ']' && child.kind() !== ',')

const findDirectOptionObject = (arrayNode: SgNode<JS>): SgNode<JS> | null =>
  getDirectArrayElements(arrayNode).find((child) => child.kind() === 'object') ?? null

const findObjectProperty = (objectNode: SgNode<JS>, propertyName: string): SgNode<JS> | null =>
  objectNode.find({
    rule: {
      kind: 'pair',
      has: {
        field: 'key',
        regex: `^["']?${propertyName}["']?$`,
      },
    },
  })

const addPropertyToObject = (objectNode: SgNode<JS>, propertySource: string): string => {
  const objectText = objectNode.text()
  if (objectText.trim() === '{}') {
    return `{ ${propertySource} }`
  }

  return `${objectText.slice(0, objectText.length - 1)}, ${propertySource}}`
}

const appendToRuleArray = (arrayNode: SgNode<JS>, source: string): string => {
  const arrayText = arrayNode.text()
  return `${arrayText.slice(0, arrayText.length - 1)}, ${source}]`
}

const addObjectPropertyToRuleOptions = (
  ruleValue: string,
  propertyName: string,
  propertySource: string,
  missingObjectFallback: string,
): string => {
  const parsed = parseRuleValue(ruleValue)
  if (!parsed) {
    return ruleValue
  }

  const ruleArray = getTopLevelRuleArray(parsed.root)
  if (!ruleArray) {
    return `[${parsed.source}, ${missingObjectFallback}]`
  }

  const optionObject = findDirectOptionObject(ruleArray)
  if (!optionObject) {
    const migratedSource = parsed.root.commitEdits([
      ruleArray.replace(appendToRuleArray(ruleArray, missingObjectFallback)),
    ])
    return unwrapRuleValue(migratedSource)
  }

  if (findObjectProperty(optionObject, propertyName)) {
    return ruleValue
  }

  const migratedSource = parsed.root.commitEdits([
    optionObject.replace(addPropertyToObject(optionObject, propertySource)),
  ])
  return unwrapRuleValue(migratedSource)
}

const oppositeCase = (flag: string): string | null => {
  if (!/^[a-z]$/i.test(flag)) {
    return null
  }

  const upper = flag.toUpperCase()
  const lower = flag.toLowerCase()

  return flag === upper ? lower : upper
}

const expandCaseInsensitiveFlags = (flags: string[]): string[] => {
  const result: string[] = []
  const seen = new Set<string>()

  const addFlag = (flag: string): void => {
    if (seen.has(flag)) {
      return
    }
    seen.add(flag)
    result.push(flag)
  }

  for (const flag of flags) {
    addFlag(flag)

    const alternate = oppositeCase(flag)
    if (alternate) {
      addFlag(alternate)
    }
  }

  return result
}

export const migrateNoInvalidRegexpRuleValue = (ruleValue: string): string => {
  const parsed = parseRuleValue(ruleValue)
  if (!parsed) {
    return ruleValue
  }

  const allowConstructorFlagsPair = parsed.root.find({
    rule: {
      kind: 'pair',
      has: {
        field: 'key',
        regex: '^["\']?allowConstructorFlags["\']?$',
      },
    },
  })
  const flagsArray = allowConstructorFlagsPair?.find({
    rule: {
      kind: 'array',
    },
  })

  if (!flagsArray) {
    return ruleValue
  }

  const flags = flagsArray.findAll({
    rule: {
      kind: 'string_fragment',
    },
  })

  const flagValues = flags.map((flag) => flag.text())
  const expandedFlags = expandCaseInsensitiveFlags(flagValues)

  if (expandedFlags.length === flagValues.length) {
    return ruleValue
  }

  const migratedSource = parsed.root.commitEdits([
    flagsArray.replace(`[${expandedFlags.map((flag) => JSON.stringify(flag)).join(', ')}]`),
  ])

  return unwrapRuleValue(migratedSource)
}

export const migrateNoImplicitCoercionRuleValue = (ruleValue: string): string => {
  const parsed = parseRuleValue(ruleValue)
  if (!parsed) {
    return ruleValue
  }

  const allowPair = parsed.root.find({
    rule: {
      kind: 'pair',
      has: {
        field: 'key',
        regex: '^["\']?allow["\']?$',
      },
    },
  })

  if (!allowPair) {
    return addObjectPropertyToRuleOptions(ruleValue, 'allow', 'allow: ["-", "- -"]', '{ allow: ["-", "- -"] }')
  }

  const allowArray = allowPair.find({
    rule: {
      kind: 'array',
    },
  })

  if (!allowArray) {
    return ruleValue
  }

  const values = allowArray
    .findAll({
      rule: {
        kind: 'string_fragment',
      },
    })
    .map((flag) => flag.text())
  const nextValues = [...values]

  for (const value of ['-', '- -']) {
    if (!nextValues.includes(value)) {
      nextValues.push(value)
    }
  }

  if (nextValues.length === values.length) {
    return ruleValue
  }

  const migratedSource = parsed.root.commitEdits([
    allowArray.replace(`[${nextValues.map((value) => JSON.stringify(value)).join(', ')}]`),
  ])
  return unwrapRuleValue(migratedSource)
}

export const migrateNoInnerDeclarationsRuleValue = (ruleValue: string): string => {
  const parsed = parseRuleValue(ruleValue)
  if (!parsed) {
    return ruleValue
  }

  const ruleArray = getTopLevelRuleArray(parsed.root)
  if (!ruleArray) {
    return `[${parsed.source}, "functions", { blockScopedFunctions: "disallow" }]`
  }

  const optionObject = findDirectOptionObject(ruleArray)
  if (optionObject) {
    if (findObjectProperty(optionObject, 'blockScopedFunctions')) {
      return ruleValue
    }

    const migratedSource = parsed.root.commitEdits([
      optionObject.replace(addPropertyToObject(optionObject, 'blockScopedFunctions: "disallow"')),
    ])
    return unwrapRuleValue(migratedSource)
  }

  const directElements = getDirectArrayElements(ruleArray)
  const fallbackOption =
    directElements.length <= 1
      ? '"functions", { blockScopedFunctions: "disallow" }'
      : '{ blockScopedFunctions: "disallow" }'
  const migratedSource = parsed.root.commitEdits([ruleArray.replace(appendToRuleArray(ruleArray, fallbackOption))])
  return unwrapRuleValue(migratedSource)
}
