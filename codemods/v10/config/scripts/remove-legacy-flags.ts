import { type Edit, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

import { applyAllTransforms, removeFlagValues } from './legacy-flag-transforms.ts'

const CHILD_PROCESS_FNS = [
  'execSync',
  'exec',
  'spawnSync',
  'spawn',
  'execFileSync',
  'execFile',
] as const satisfies readonly string[]

function transformStringNode(node: SgNode<JS>, transform: (s: string) => string): Edit | null {
  const nodeText = node.text()
  if (nodeText.length < 2) return null
  const quote = nodeText[0]
  const inner = nodeText.slice(1, -1)
  const newInner = transform(inner)
  if (newInner === inner) return null
  return node.replace(`${quote}${newInner}${quote}`)
}

function transformTemplateStringNode(node: SgNode<JS>, transform: (s: string) => string): Edit | null {
  if (node.find({ rule: { kind: 'template_substitution' } })) return null
  const nodeText = node.text()
  if (nodeText.length < 2) return null
  const inner = nodeText.slice(1, -1)
  const newInner = transform(inner)
  if (newInner === inner) return null
  return node.replace(`\`${newInner}\``)
}

function getFirstStringArg(callExpr: SgNode<JS>): SgNode<JS> | null {
  const args = callExpr.find({ rule: { kind: 'arguments' } })
  if (!args) return null
  const children = args.children()
  for (const child of children) {
    const kind = child.kind()
    if (kind === 'string' || kind === 'template_string') return child
    if (kind !== '(' && kind !== ')' && kind !== ',') break
  }
  return null
}

function isChildProcessCall(callExpr: SgNode<JS>): boolean {
  const callee = callExpr.child(0)
  if (!callee) return false

  if (callee.kind() === 'identifier') {
    return (CHILD_PROCESS_FNS as readonly string[]).includes(callee.text())
  }

  if (callee.kind() === 'member_expression') {
    const prop = callee.find({ rule: { kind: 'property_identifier' } })
    if (!prop) return false
    return (CHILD_PROCESS_FNS as readonly string[]).includes(prop.text())
  }

  return false
}

function isEslintFlagsAssignment(assignExpr: SgNode<JS>): boolean {
  const lhs = assignExpr.child(0)
  if (lhs?.kind() !== 'member_expression') return false
  const lhsText = lhs.text()
  return lhsText === 'process.env.ESLINT_FLAGS'
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  for (const callExpr of rootNode.findAll({ rule: { kind: 'call_expression' } })) {
    if (!isChildProcessCall(callExpr)) continue
    const firstArg = getFirstStringArg(callExpr)
    if (!firstArg) continue
    const kind = firstArg.kind()
    const edit =
      kind === 'string'
        ? transformStringNode(firstArg, applyAllTransforms)
        : kind === 'template_string'
          ? transformTemplateStringNode(firstArg, applyAllTransforms)
          : null
    if (edit) edits.push(edit)
  }

  for (const assignExpr of rootNode.findAll({ rule: { kind: 'assignment_expression' } })) {
    if (!isEslintFlagsAssignment(assignExpr)) continue
    const rhs = assignExpr.child(2)
    if (!rhs) continue
    const kind = rhs.kind()
    const edit =
      kind === 'string'
        ? transformStringNode(rhs, removeFlagValues)
        : kind === 'template_string'
          ? transformTemplateStringNode(rhs, removeFlagValues)
          : null
    if (edit) edits.push(edit)
  }

  if (edits.length === 0) return null
  return rootNode.commitEdits(edits)
}
