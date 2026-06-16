import type { Edit, RuleConfig, SgNode, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const GET_COMMENTS_SELECTOR = {
  rule: {
    kind: 'call_expression',
    has: {
      kind: 'member_expression',
      has: {
        kind: 'property_identifier',
        regex: '^getComments$',
      },
    },
  },
} as const satisfies RuleConfig<JS>

const getCallArgs = (call: SgNode<JS>): string[] => {
  const argsNode = call.children().find((child) => child.kind() === 'arguments') ?? null
  if (!argsNode) {
    return []
  }

  return argsNode
    .children()
    .filter((child) => child.kind() !== '(' && child.kind() !== ')' && child.kind() !== ',')
    .map((child) => child.text())
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const call of rootNode.findAll(GET_COMMENTS_SELECTOR)) {
    const memberExpr = call.children().find((child) => child.kind() === 'member_expression') ?? null
    if (!memberExpr) {
      continue
    }

    const propNode = memberExpr.children().find((child) => child.kind() === 'property_identifier') ?? null
    if (!propNode) {
      continue
    }

    const method = propNode.text()
    const memberText = memberExpr.text()
    const src = memberText.slice(0, memberText.lastIndexOf(`.${method}`))
    const args = getCallArgs(call)
    const nodeArg = args[0]

    if (nodeArg) {
      edits.push(
        call.replace(
          `[...${src}.getCommentsBefore(${nodeArg}), ...${src}.getCommentsInside(${nodeArg}), ...${src}.getCommentsAfter(${nodeArg})]`,
        ),
      )
    } else {
      edits.push(
        call.replace(`[...${src}.getCommentsBefore(), ...${src}.getCommentsInside(), ...${src}.getCommentsAfter()]`),
      )
    }
  }

  if (edits.length === 0) {
    return null
  }

  return rootNode.commitEdits(edits)
}
