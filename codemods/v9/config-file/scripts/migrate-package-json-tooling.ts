import type { Edit, SgRoot } from 'codemod:ast-grep'
import type JSONLang from 'codemod:ast-grep/langs/json'

const REMOVED_FORMATTERS: Record<string, string> = {
  checkstyle: 'eslint-formatter-checkstyle',
  compact: 'eslint-formatter-compact',
  'jslint-xml': 'eslint-formatter-jslint-xml',
  junit: 'eslint-formatter-junit',
  tap: 'eslint-formatter-tap',
  unix: 'eslint-formatter-unix',
  visualstudio: 'eslint-formatter-visualstudio',
}

const migrateEslintScript = (script: string): string => {
  let next = script

  for (const [formatter, replacement] of Object.entries(REMOVED_FORMATTERS)) {
    next = next.replaceAll(new RegExp(`(-f|--format)\\s+${formatter}(?=\\s|$)`, 'g'), `$1 ${replacement}`)
  }

  if (!/\beslint\b/.test(next) || /--pass-on-no-patterns\b/.test(next)) {
    return next
  }

  const hasFilePattern =
    /(?:^|\s)(?:\.|\.\/|\.\.\/|\*\*|\*\.|\w+\/|".*"|'.*'|tests?\/|src\/|lib\/|app\/|packages\/|\bsrc\b|\btest\b|\btests\b|\blib\b)\S*(?:\s|$)/.test(
      next,
    )

  if (!hasFilePattern && /\beslint(?:\s|$)/.test(next.trim())) {
    next = `${next.trimEnd()} .`
  }

  return next
}

const parseJsonString = (quoted: string): string | null => {
  try {
    return JSON.parse(quoted) as string
  } catch {
    return null
  }
}

export default async function transform(root: SgRoot<JSONLang>): Promise<string | null> {
  const rootNode = root.root()
  const rootObject = rootNode.find({ rule: { kind: 'object' } })

  if (!rootObject) {
    return null
  }

  const scriptsPair = rootObject.find({
    rule: {
      kind: 'pair',
      has: {
        kind: 'string',
        nthChild: 1,
        has: {
          kind: 'string_content',
          regex: '^scripts$',
        },
      },
    },
  })

  if (!scriptsPair) {
    return null
  }

  const scriptsObject = scriptsPair.find({ rule: { kind: 'object' } })
  if (!scriptsObject) {
    return null
  }

  const edits: Edit[] = []

  for (const scriptPair of scriptsObject.findAll({ rule: { kind: 'pair' } })) {
    const strings = scriptPair.findAll({ rule: { kind: 'string' } })
    if (strings.length < 2) {
      continue
    }

    const keyString = strings[0]
    const valueString = strings[1]
    if (!keyString || !valueString) {
      continue
    }

    const key = keyString.find({ rule: { kind: 'string_content' } })?.text()
    const script = parseJsonString(valueString.text())

    if (key === 'eslintConfig' || script === null || !/\beslint(?:\s|$|--|-f\b)/.test(script)) {
      continue
    }

    const migrated = migrateEslintScript(script)
    if (migrated === script) {
      continue
    }

    edits.push(valueString.replace(JSON.stringify(migrated)))
  }

  if (edits.length === 0) {
    return null
  }

  return rootNode.commitEdits(edits)
}
