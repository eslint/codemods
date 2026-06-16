import type { SgRoot } from 'codemod:ast-grep'
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

const SCRIPT_PAIR_PATTERN = /"([^"]+)"\s*:\s*"([^"]*)"/g

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

export default async function transform(root: SgRoot<JSONLang>): Promise<string | null> {
  let source = root.root().text()
  let changed = false

  source = source.replaceAll(SCRIPT_PAIR_PATTERN, (match, key: string, script: string) => {
    if (key === 'eslintConfig' || !/\beslint(?:\s|$|--|-f\b)/.test(script)) {
      return match
    }
    const migrated = migrateEslintScript(script)
    if (migrated === script) {
      return match
    }
    changed = true
    return `"${key}": ${JSON.stringify(migrated)}`
  })

  return changed ? source : null
}
