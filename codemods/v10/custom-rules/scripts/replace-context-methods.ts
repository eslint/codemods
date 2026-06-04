import { type Edit, type RuleConfig, type SgNode, type SgRoot, parse } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// Method calls → direct property accesses
const METHOD_TO_PROP: Record<string, string> = {
  getFilename: 'filename',
  getPhysicalFilename: 'physicalFilename',
  getCwd: 'cwd',
  getSourceCode: 'sourceCode',
}

const DEPRECATED_METHODS_REGEX = `^(${Object.keys(METHOD_TO_PROP).join('|')})$`

// ── Selectors ──────────────────────────────────────────────────────────────

function getFallbackPatternSelector(): RuleConfig<JS> {
  // Matches: context.filename ?? context.getFilename()
  // tree-sitter uses binary_expression for all binary operators incl. ??
  return {
    rule: {
      kind: 'binary_expression',
      has: {
        kind: 'call_expression',
        has: {
          kind: 'member_expression',
          has: {
            kind: 'property_identifier',
            regex: DEPRECATED_METHODS_REGEX,
          },
        },
      },
    },
  }
}

function getMethodCallSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'call_expression',
      has: {
        kind: 'member_expression',
        has: {
          kind: 'property_identifier',
          regex: DEPRECATED_METHODS_REGEX,
        },
      },
    },
  }
}

function getParserOptionsSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'member_expression',
      has: {
        kind: 'property_identifier',
        regex: '^parserOptions$',
      },
      not: {
        // skip languageOptions.parserOptions — already migrated
        inside: {
          kind: 'member_expression',
          has: {
            kind: 'property_identifier',
            regex: '^languageOptions$',
          },
        },
      },
    },
  }
}

function getParserPathSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: 'member_expression',
      has: {
        kind: 'property_identifier',
        regex: '^parserPath$',
      },
    },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPropertyName(memberExpr: SgNode<JS>): string {
  const prop = memberExpr.find({ rule: { kind: 'property_identifier' } })
  return prop?.text() ?? ''
}

function getSourceObject(memberExpr: SgNode<JS>): string {
  const text = memberExpr.text()
  const prop = getPropertyName(memberExpr)
  return text.slice(0, text.lastIndexOf(`.${prop}`))
}

function isNullishCoalescing(expr: SgNode<JS>): boolean {
  return expr.children().some((c: SgNode<JS>) => c.text() === '??')
}

// ── Transform ──────────────────────────────────────────────────────────────

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()

  // ── Pass 1: collapse ?? fallback patterns ─────────────────────────────
  // Must run before method call transforms to avoid overlapping edits.
  // context.filename ?? context.getFilename() → context.filename
  const fallbackEdits: Edit[] = []
  for (const expr of rootNode.findAll(getFallbackPatternSelector())) {
    if (!isNullishCoalescing(expr)) continue

    const children = expr.children().filter((c: SgNode<JS>) => c.text() !== '??')
    const left = children[0]
    const right = children[1]
    if (!left || !right) continue

    // skip if the deprecated call is the left operand — pass 2 handles it
    const rightText = right.text()
    const rightHasDeprecatedCall = Object.keys(METHOD_TO_PROP).some((m) => rightText.includes(`.${m}(`))
    if (!rightHasDeprecatedCall) continue

    fallbackEdits.push(expr.replace(left.text()))
  }

  let text = rootNode.text()
  if (fallbackEdits.length > 0) {
    text = rootNode.commitEdits(fallbackEdits)
  }

  // Re-parse after pass 1 so subsequent selectors operate on updated AST
  const updatedRoot = parse('javascript', text).root() as unknown as SgNode<JS>
  const mainEdits: Edit[] = []

  // ── Pass 2: method call → property access ─────────────────────────────
  // context.getFilename() → context.filename
  for (const call of updatedRoot.findAll(getMethodCallSelector())) {
    const memberExpr = call.find({ rule: { kind: 'member_expression' } })
    if (!memberExpr) continue
    const method = getPropertyName(memberExpr)
    const prop = METHOD_TO_PROP[method]
    if (!prop) continue
    const src = getSourceObject(memberExpr)
    mainEdits.push(call.replace(`${src}.${prop}`))
  }

  // ── Pass 3: context.parserOptions → context.languageOptions.parserOptions
  for (const memberExpr of updatedRoot.findAll(getParserOptionsSelector())) {
    const src = getSourceObject(memberExpr)
    mainEdits.push(memberExpr.replace(`${src}.languageOptions.parserOptions`))
  }

  // ── Pass 4: context.parserPath — no replacement, flag with TODO ────────
  for (const memberExpr of updatedRoot.findAll(getParserPathSelector())) {
    const original = memberExpr.text()
    mainEdits.push(
      memberExpr.replace(`${original} /* TODO: context.parserPath removed in ESLint v10, no replacement */`),
    )
  }

  if (mainEdits.length > 0) {
    text = updatedRoot.commitEdits(mainEdits)
  }

  const changed = fallbackEdits.length > 0 || mainEdits.length > 0
  return changed ? text : null
}
