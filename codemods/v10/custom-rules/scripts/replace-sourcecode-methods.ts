import { type Edit, type RuleConfig, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// Single source of truth — add a new entry here, nothing else changes
const RENAME: Record<string, string> = {
  getTokenOrCommentBefore: 'getTokenBefore',
  getTokenOrCommentAfter: 'getTokenAfter',
}

const ALL_REMOVED = [...Object.keys(RENAME), 'isSpaceBetweenTokens', 'getJSDocComment']

function getSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'call_expression',
      has: {
        kind: 'member_expression',
        has: {
          kind: 'property_identifier',
          regex: `^(${ALL_REMOVED.join('|')})$`,
        },
      },
    },
  }
}

function getCallArgs(call: SgNode<JS>): string[] {
  const argsNode = call.find({ rule: { kind: 'arguments' } })
  if (!argsNode) return []
  return argsNode
    .children()
    .filter((c: SgNode<JS>) => c.kind() !== '(' && c.kind() !== ')' && c.kind() !== ',')
    .map((c: SgNode<JS>) => c.text())
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const call of rootNode.findAll(getSelector())) {
    const memberExpr = call.find({ rule: { kind: 'member_expression' } })
    if (!memberExpr) continue

    const propNode = memberExpr.find({ rule: { kind: 'property_identifier' } })
    if (!propNode) continue

    const method = propNode.text()
    const memberText = memberExpr.text()
    const src = memberText.slice(0, memberText.lastIndexOf(`.${method}`))
    const args = getCallArgs(call)

    if (method in RENAME) {
      const newMethod = RENAME[method] as string
      const skipPart = args[1] !== undefined ? `, skip: ${args[1]}` : ''
      const firstArg = args[0]
      const replacement =
        firstArg !== undefined
          ? `${src}.${newMethod}(${firstArg}, { includeComments: true${skipPart} })`
          : `${src}.${newMethod}({ includeComments: true${skipPart} })`
      edits.push(call.replace(replacement))
    } else if (method === 'isSpaceBetweenTokens') {
      edits.push(call.replace(`${src}.isSpaceBetween(${args.join(', ')})`))
    } else if (method === 'getJSDocComment') {
      edits.push(call.replace(`(null /* TODO: getJSDocComment removed in ESLint v10, no replacement */)`))
    }
  }

  return edits.length > 0 ? rootNode.commitEdits(edits) : null
}
