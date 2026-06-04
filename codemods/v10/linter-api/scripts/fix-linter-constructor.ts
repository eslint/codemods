import { type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// ─── Linter constructor: configType option removed ───────────────────────────
// new Linter({ configType: 'flat' }) → new Linter()
const LINTER_FLAT_RE = /new\s+Linter\s*\(\s*\{\s*configType\s*:\s*(['"`])flat\1\s*\}\s*\)/g

// new Linter({ configType: 'flat', ...rest }) → new Linter({ ...rest })
const LINTER_FLAT_LEADING_RE = /new\s+Linter\s*\(\s*\{([^}]*?)configType\s*:\s*(['"`])flat\2\s*,([^}]*?)\}\s*\)/g
const LINTER_FLAT_TRAILING_RE = /new\s+Linter\s*\(\s*\{([^}]*?),\s*configType\s*:\s*(['"`])flat\2\s*\}\s*\)/g

// new Linter({ configType: 'eslintrc' }) → new Linter(/* TODO */)
const LINTER_ESLINTRC_RE = /new\s+Linter\s*\(\s*\{\s*configType\s*:\s*(['"`])eslintrc\1\s*\}\s*\)/g

// ─── loadESLint: useFlatConfig option removed ────────────────────────────────
// loadESLint({ useFlatConfig: true/false }) → loadESLint()
const LOAD_ESLINT_RE = /loadESLint\s*\(\s*\{\s*useFlatConfig\s*:\s*(?:true|false)\s*\}\s*\)/g

// ─── ESLint flags array: remove removed flag values ──────────────────────────
const REMOVED_FLAGS = ['v10_config_lookup_from_file', 'unstable_config_lookup_from_file']

// ─── Deprecated Linter instance methods removed in v10 ──────────────────────
const DEPRECATED_METHODS = ['defineParser', 'defineRule', 'defineRules', 'getRules']

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const source = root.root().text()
  let result = source

  // 1. new Linter({ configType: 'flat' }) → new Linter()
  result = result.replaceAll(LINTER_FLAT_RE, 'new Linter()')

  // 2. new Linter({ configType: 'flat', ...rest }) → new Linter({ ...rest })
  // Leading: configType is first/middle — keep options before AND after it
  result = result.replaceAll(LINTER_FLAT_LEADING_RE, (_m: string, before: string, _q: string, after: string) => {
    const b = before.trim().replace(/,\s*$/, '')
    const a = after.trim().replace(/^,\s*/, '')
    const parts = [b, a].filter(Boolean).join(', ')
    return parts ? `new Linter({ ${parts} })` : 'new Linter()'
  })
  // Trailing: configType is last — keep everything before it
  result = result.replaceAll(LINTER_FLAT_TRAILING_RE, (_m: string, before: string) => {
    const rest = before.trim().replace(/,\s*$/, '')
    return rest ? `new Linter({ ${rest} })` : 'new Linter()'
  })
  // Clean up empty object literals left behind by multiline cases
  result = result.replaceAll(/new\s+Linter\s*\(\s*\{\s*\}\s*\)/g, 'new Linter()')

  // 3. new Linter({ configType: 'eslintrc' }) → new Linter(/* TODO */)
  result = result.replaceAll(
    LINTER_ESLINTRC_RE,
    'new Linter(/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */)',
  )

  // 4. loadESLint({ useFlatConfig: ... }) → loadESLint()
  result = result.replaceAll(LOAD_ESLINT_RE, 'loadESLint()')

  // 5. Remove removed flag values from new ESLint({ flags: [...] })
  for (const flag of REMOVED_FLAGS) {
    result = result.replaceAll(new RegExp(`(['"\`])${flag}\\1\\s*,?|,?\\s*(['"\`])${flag}\\2`, 'g'), '')
    result = result
      .replaceAll(/\[\s*,\s*/g, '[')
      .replaceAll(/,\s*\]/g, ']')
      .replaceAll(/,\s*,/g, ',')
      .replaceAll(/\[\s+(['"`])/g, '[$1')
  }

  // 6. Deprecated Linter instance methods → TODO comment
  for (const method of DEPRECATED_METHODS) {
    result = result.replaceAll(
      new RegExp(`\\.${method}\\s*\\(`, 'g'),
      `.${method}(/* TODO: ${method}() removed in ESLint v10, no replacement */ `,
    )
  }

  return result === source ? null : result
}
