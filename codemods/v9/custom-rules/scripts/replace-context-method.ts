import { type Edit, type SgRoot, type RuleConfig, type SgNode, parse } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// ============ Selectors ============

function getCreateBlockSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'statement_block',
      inside: {
        any: [
          {
            kind: 'function_expression',
            inside: {
              kind: 'pair',
              has: {
                kind: 'property_identifier',
                regex: '^create$',
              },
            },
          },
          {
            kind: 'arrow_function',
            inside: {
              kind: 'pair',
              has: {
                kind: 'property_identifier',
                regex: '^create$',
              },
            },
          },
          // create: hoc(function (context) { … }) — rule fn is inside call arguments
          {
            kind: 'function_expression',
            inside: {
              kind: 'arguments',
              inside: {
                kind: 'call_expression',
                inside: {
                  kind: 'pair',
                  has: {
                    kind: 'property_identifier',
                    regex: '^create$',
                  },
                },
              },
            },
          },
          {
            kind: 'arrow_function',
            inside: {
              kind: 'arguments',
              inside: {
                kind: 'call_expression',
                inside: {
                  kind: 'pair',
                  has: {
                    kind: 'property_identifier',
                    regex: '^create$',
                  },
                },
              },
            },
          },
          {
            kind: 'method_definition',
            has: {
              kind: 'property_identifier',
              regex: '^create$',
            },
          },
        ],
      },
    },
  }
}

function getAlreadyTransformedSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'variable_declarator',
      has: {
        kind: 'identifier',
        regex: '^contextSourceCode$',
      },
    },
  }
}

// ============ Constants ============

// Context methods that became properties (deprecated in favor of property; use property ?? method())
const CONTEXT_METHOD_TO_PROPERTY: Record<string, string> = {
  getSourceCode: 'sourceCode',
  getFilename: 'filename',
  getPhysicalFilename: 'physicalFilename',
  getCwd: 'cwd',
}

// Methods that move from context to sourceCode (with optional rename)
const CONTEXT_METHOD_MAP: Record<string, string> = {
  getSource: 'getText',
  getSourceLines: 'getLines',
  getAllComments: 'getAllComments',
  getNodeByRangeIndex: 'getNodeByRangeIndex',
  getCommentsBefore: 'getCommentsBefore',
  getCommentsAfter: 'getCommentsAfter',
  getCommentsInside: 'getCommentsInside',
  getJSDocComment: 'getJSDocComment',
  getFirstToken: 'getFirstToken',
  getFirstTokens: 'getFirstTokens',
  getLastToken: 'getLastToken',
  getLastTokens: 'getLastTokens',
  getTokenAfter: 'getTokenAfter',
  getTokenBefore: 'getTokenBefore',
  getTokenByRangeStart: 'getTokenByRangeStart',
  getTokens: 'getTokens',
  getTokensAfter: 'getTokensAfter',
  getTokensBefore: 'getTokensBefore',
  getTokensBetween: 'getTokensBetween',
  parserServices: 'parserServices',
  getDeclaredVariables: 'getDeclaredVariables',
}

// Methods that STAY on context - do NOT transform these
const CONTEXT_ONLY_METHODS = new Set([
  'report',
  'options',
  'settings',
  'parserPath',
  'parserOptions',
  'languageOptions',
])

// ============ Helpers ============

function extractContextName(createRule: SgNode<JS>): string {
  let context = 'context'
  const parentFunction = createRule.parent()

  if (parentFunction) {
    const formalParams = parentFunction.find({ rule: { kind: 'formal_parameters' } })
    if (formalParams) {
      const firstParam = formalParams.find({ rule: { kind: 'identifier' } })
      if (firstParam) {
        context = firstParam.text()
      }
    } else if (parentFunction.kind() === 'arrow_function') {
      const firstChild = parentFunction.find({ rule: { kind: 'identifier' } })
      if (firstChild) {
        context = firstChild.text()
      }
    }
  }

  return context
}

function isOldStyleReport(argsNode: SgNode<JS>): boolean {
  const children = argsNode.children()
  const args = children.filter((child) => child.kind() !== '(' && child.kind() !== ')' && child.kind() !== ',')

  // Old style has 2 or 3 arguments where first is not an object
  if (args.length < 2) return false

  const firstArg = args[0]
  if (!firstArg) return false

  return firstArg.kind() !== 'object'
}

function isPartOfCodePathCurrentSegmentsChain(callNode: SgNode<JS>): boolean {
  // context.getSourceCode().codePath.currentSegments - call is object of .codePath
  const parent = callNode.parent()
  if (parent?.kind() !== 'member_expression') return false
  const codePathProp = parent.find({
    rule: { kind: 'property_identifier', regex: '^codePath$' },
  })
  if (!codePathProp) return false
  const codePathMember = parent
  const grandparent = codePathMember.parent()
  if (grandparent?.kind() !== 'member_expression') return false
  const currentSegmentsProp = grandparent.find({
    rule: { kind: 'property_identifier', regex: '^currentSegments$' },
  })
  return !!currentSegmentsProp
}

/** Chained access: context.getSourceCode().getText() — inner call is object of member_expression. */
function isChainedOffGetSourceCode(callNode: SgNode<JS>): boolean {
  const parent = callNode.parent()
  return parent?.kind() === 'member_expression'
}

/**
 * Returns the first param identifier of the immediately enclosing visitor
 * function, plus whether we need to inject "node" as a parameter because the
 * visitor was declared with an empty parameter list (e.g. `Program() {}`).
 *
 * Unlike the old helper this function STOPS at the first enclosing function
 * even when that function has no parameters.  The old code walked past an
 * empty-param visitor and returned the `context` name from `create(context)`,
 * which produced invalid output such as `contextSourceCode.getScope(context)`.
 */
function getFirstEnclosingFunctionInfo(start: SgNode<JS>): {
  param: string
  formalParamsNode: SgNode<JS> | null
  needsInjection: boolean
} {
  let current: SgNode<JS> | null = start.parent()
  while (current) {
    const kind = current.kind()
    if (kind === 'function_expression' || kind === 'function_declaration' || kind === 'method_definition') {
      const formalParams = current.find({ rule: { kind: 'formal_parameters' } })
      if (formalParams) {
        const firstParam = formalParams.find({ rule: { kind: 'identifier' } })
        if (firstParam) {
          return { param: firstParam.text(), formalParamsNode: null, needsInjection: false }
        }
        return { param: 'node', formalParamsNode: formalParams, needsInjection: true }
      }
    } else if (kind === 'arrow_function') {
      const formalParams = current.find({ rule: { kind: 'formal_parameters' } })
      if (formalParams) {
        const firstParam = formalParams.find({ rule: { kind: 'identifier' } })
        if (firstParam) {
          return { param: firstParam.text(), formalParamsNode: null, needsInjection: false }
        }
        return { param: 'node', formalParamsNode: formalParams, needsInjection: true }
      }
      // Arrow with a single identifier param: `node => {}` — param exists, no injection needed.
      // Stop here so we don't climb to create(context).
      return { param: 'node', formalParamsNode: null, needsInjection: false }
    }
    current = current.parent()
  }
  return { param: 'node', formalParamsNode: null, needsInjection: false }
}

function getCallExpressionListArgs(argsNode: SgNode<JS> | null | undefined): SgNode<JS>[] {
  if (!argsNode) return []
  const children = argsNode.children()
  return children.filter((child) => child.kind() !== '(' && child.kind() !== ')' && child.kind() !== ',')
}

/** Whether we should inject `const contextSourceCode = ...` (any transform uses that binding). */
function computeNeedsContextSourceCodeConst(
  newRoot: SgNode<JS>,
  context: string,
  alreadyHasContextSourceCode: boolean,
): boolean {
  if (alreadyHasContextSourceCode) return false
  const expressions = newRoot.findAll({
    rule: {
      kind: 'call_expression',
      has: {
        kind: 'member_expression',
        pattern: '$IDENTIFIER.$PROPERTY',
      },
    },
  })
  for (const expression of expressions) {
    const identifier = expression.getMatch('IDENTIFIER')
    const property = expression.getMatch('PROPERTY')
    if (!identifier || !property || identifier.text() !== context) continue
    const propertyText = property.text()
    if (CONTEXT_ONLY_METHODS.has(propertyText)) continue
    if (propertyText in CONTEXT_METHOD_TO_PROPERTY) {
      if (propertyText !== 'getSourceCode') continue
      if (isPartOfCodePathCurrentSegmentsChain(expression as unknown as SgNode<JS>)) continue
      if (isChainedOffGetSourceCode(expression as unknown as SgNode<JS>)) return true
      continue
    }
    if (propertyText in CONTEXT_METHOD_MAP) return true
    if (propertyText === 'getComments') return true
    if (propertyText === 'getAncestors' || propertyText === 'getScope') return true
    if (propertyText === 'markVariableAsUsed') return true
  }
  return false
}

function transformOldStyleReport(expression: SgNode<JS>, contextName: string): string | null {
  const argsNode = expression.find({ rule: { kind: 'arguments' } })
  if (!argsNode) return null

  const children = argsNode.children()
  const args = children.filter((child) => child.kind() !== '(' && child.kind() !== ')' && child.kind() !== ',')

  if (args.length < 2) return null

  const nodeArg = args[0]?.text()
  const messageArg = args[1]?.text()
  const dataArg = args[2]?.text()

  if (!nodeArg || !messageArg) return null

  if (dataArg) {
    return `${contextName}.report({ node: ${nodeArg}, message: ${messageArg}, data: ${dataArg} })`
  }
  return `${contextName}.report({ node: ${nodeArg}, message: ${messageArg} })`
}

// ============ Transform ============

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  const createRule = rootNode.find(getCreateBlockSelector())

  if (!createRule) {
    return null
  }

  const alreadyHasContextSourceCode = !!createRule.find(getAlreadyTransformedSelector())

  let text = createRule.text()
  const context = extractContextName(createRule)

  let newRoot = parse('javascript', text).root()
  const prependContextSourceCodeConst = computeNeedsContextSourceCodeConst(
    newRoot as unknown as SgNode<JS>,
    context,
    alreadyHasContextSourceCode,
  )

  const chainEdits: Edit[] = []
  if (!alreadyHasContextSourceCode) {
    const getSourceCalls = newRoot.findAll({
      rule: {
        kind: 'call_expression',
        has: {
          kind: 'member_expression',
          pattern: '$IDENTIFIER.$PROPERTY',
        },
      },
    })
    for (const expression of getSourceCalls) {
      const identifier = expression.getMatch('IDENTIFIER')
      const property = expression.getMatch('PROPERTY')
      if (!identifier || !property) continue
      if (identifier.text() !== context || property.text() !== 'getSourceCode') continue
      if (isPartOfCodePathCurrentSegmentsChain(expression as unknown as SgNode<JS>)) continue
      if (isChainedOffGetSourceCode(expression as unknown as SgNode<JS>)) {
        chainEdits.push(expression.replace('contextSourceCode'))
      }
    }
  }

  if (chainEdits.length > 0) {
    text = newRoot.commitEdits(chainEdits)
    newRoot = parse('javascript', text).root()
  }

  const expressions = newRoot.findAll({
    rule: {
      kind: 'call_expression',
      has: {
        kind: 'member_expression',
        pattern: '$IDENTIFIER.$PROPERTY',
      },
    },
  })
  const newRootEdits: Edit[] = []
  // Tracks formal_parameters nodes that need "node" injected, keyed by start index.
  const pendingParamInjections = new Map<number, SgNode<JS>>()
  let needsContextSourceCode = prependContextSourceCodeConst

  function scheduleNodeParamInjection(formalParamsNode: SgNode<JS>): void {
    const key = formalParamsNode.range().start.index
    pendingParamInjections.set(key, formalParamsNode)
  }

  for (const expression of expressions) {
    const identifier = expression.getMatch('IDENTIFIER')
    const property = expression.getMatch('PROPERTY')
    if (!identifier || !property) continue
    if (identifier.text() !== context) continue

    const propertyText = property.text()

    if (CONTEXT_ONLY_METHODS.has(propertyText)) {
      continue
    }

    if (propertyText in CONTEXT_METHOD_TO_PROPERTY) {
      if (
        propertyText === 'getSourceCode' &&
        isPartOfCodePathCurrentSegmentsChain(expression as unknown as SgNode<JS>)
      ) {
        continue
      }
      if (propertyText === 'getSourceCode' && isChainedOffGetSourceCode(expression as unknown as SgNode<JS>)) {
        continue
      }
      const prop = CONTEXT_METHOD_TO_PROPERTY[propertyText] as string
      if (propertyText === 'getSourceCode') {
        if (prependContextSourceCodeConst) {
          newRootEdits.push(expression.replace('contextSourceCode'))
        } else {
          newRootEdits.push(expression.replace(`${context}.${prop} ?? ${context}.${propertyText}()`))
        }
      } else {
        // Wrap in parens when the result is chained (e.g. context.getFilename().endsWith(".ts"))
        const isChained = expression.parent()?.kind() === 'member_expression'
        const replacement = `${context}.${prop} ?? ${context}.${propertyText}()`
        newRootEdits.push(expression.replace(isChained ? `(${replacement})` : replacement))
      }
      continue
    }

    if (!alreadyHasContextSourceCode) {
      if (propertyText in CONTEXT_METHOD_MAP) {
        if (propertyText === 'getDeclaredVariables') {
          const argsNode = expression.find({ rule: { kind: 'arguments' } })
          const args = getCallExpressionListArgs(argsNode as unknown as SgNode<JS>)
          if (args.length === 0) {
            const enclosing = getFirstEnclosingFunctionInfo(expression as unknown as SgNode<JS>)
            if (enclosing.needsInjection && enclosing.formalParamsNode) {
              scheduleNodeParamInjection(enclosing.formalParamsNode as unknown as SgNode<JS>)
            }
            newRootEdits.push(expression.replace(`contextSourceCode.getDeclaredVariables(${enclosing.param})`))
          } else {
            newRootEdits.push(property.replace(CONTEXT_METHOD_MAP[propertyText] as string))
            newRootEdits.push(identifier.replace('contextSourceCode'))
          }
        } else {
          newRootEdits.push(property.replace(CONTEXT_METHOD_MAP[propertyText] as string))
          newRootEdits.push(identifier.replace('contextSourceCode'))
        }
        needsContextSourceCode = true
      } else if (propertyText === 'getComments') {
        newRootEdits.push(
          expression.replace(
            '[...contextSourceCode.getCommentsBefore(), ...contextSourceCode.getCommentsInside(), ...contextSourceCode.getCommentsAfter()]',
          ),
        )
        needsContextSourceCode = true
      } else if (propertyText === 'getAncestors') {
        const enclosing = getFirstEnclosingFunctionInfo(expression as unknown as SgNode<JS>)
        if (enclosing.needsInjection && enclosing.formalParamsNode) {
          scheduleNodeParamInjection(enclosing.formalParamsNode as unknown as SgNode<JS>)
        }
        newRootEdits.push(
          expression.replace(
            `(contextSourceCode.getAncestors ? contextSourceCode.getAncestors(${enclosing.param}) : ${context}.getAncestors())`,
          ),
        )
        needsContextSourceCode = true
      } else if (propertyText === 'getScope') {
        const enclosing = getFirstEnclosingFunctionInfo(expression as unknown as SgNode<JS>)
        if (enclosing.needsInjection && enclosing.formalParamsNode) {
          scheduleNodeParamInjection(enclosing.formalParamsNode as unknown as SgNode<JS>)
        }
        newRootEdits.push(expression.replace(`contextSourceCode.${propertyText}(${enclosing.param})`))
        needsContextSourceCode = true
      } else if (propertyText === 'markVariableAsUsed') {
        const argsNode = expression.find({ rule: { kind: 'arguments' } })
        const args = getCallExpressionListArgs(argsNode as unknown as SgNode<JS>)
        const nameArg = args[0]?.text() ?? '"name"'
        const enclosing = getFirstEnclosingFunctionInfo(expression as unknown as SgNode<JS>)
        if (enclosing.needsInjection && enclosing.formalParamsNode) {
          scheduleNodeParamInjection(enclosing.formalParamsNode as unknown as SgNode<JS>)
        }
        newRootEdits.push(expression.replace(`contextSourceCode.markVariableAsUsed(${nameArg}, ${enclosing.param})`))
        needsContextSourceCode = true
      }
    }

    if (propertyText === 'report') {
      const argsNode = expression.find({ rule: { kind: 'arguments' } })
      if (argsNode && isOldStyleReport(argsNode as unknown as SgNode<JS>)) {
        const transformed = transformOldStyleReport(expression as unknown as SgNode<JS>, context)
        if (transformed) {
          newRootEdits.push(expression.replace(transformed))
        }
      }
    }
  }

  // Add all pending formal_parameters injections (deduplicated by start index).
  for (const formalParamsNode of pendingParamInjections.values()) {
    newRootEdits.push((formalParamsNode as unknown as SgNode<JS>).replace('(node)'))
  }

  if (newRootEdits.length === 0 && chainEdits.length === 0) {
    return null
  }

  if (newRootEdits.length > 0) {
    text = newRoot.commitEdits(newRootEdits)
  }

  let newCreate: string
  if (needsContextSourceCode && !alreadyHasContextSourceCode) {
    newCreate = `{
    const contextSourceCode = ${context}.sourceCode ?? ${context}.getSourceCode();${text.slice(1)}`
  } else {
    newCreate = text
  }
  edits.push(createRule.replace(newCreate))

  return rootNode.commitEdits(edits)
}
