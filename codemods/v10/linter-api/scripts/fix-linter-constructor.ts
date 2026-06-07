import type { SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// ─── Linter constructor: configType option removed ───────────────────────────
// new Linter({ configType: 'flat' }) → new Linter()
const LINTER_FLAT_RE = /new\s+Linter\s*\(\s*\{\s*configType\s*:\s*(['"`])flat\1\s*\}\s*\)/g

// new Linter({ configType: 'flat', ...rest }) → new Linter({ ...rest })
const LINTER_FLAT_LEADING_RE = /new\s+Linter\s*\(\s*\{([^}]*?)configType\s*:\s*(['"`])flat\2\s*,([^}]*?)\}\s*\)/g
const LINTER_FLAT_TRAILING_RE = /new\s+Linter\s*\(\s*\{([^}]*?),\s*configType\s*:\s*(['"`])flat\2\s*\}\s*\)/g

// new Linter({ configType: 'eslintrc' }) → new Linter(/* TODO */)
const LINTER_ESLINTRC_RE = /new\s+Linter\s*\(\s*\{\s*configType\s*:\s*(['"`])eslintrc\1\s*\}\s*\)/g

// new Linter({ configType: 'eslintrc', ...rest }) → new Linter({ ...rest /* TODO */ })
const LINTER_ESLINTRC_LEADING_RE =
  /new\s+Linter\s*\(\s*\{([^}]*?)configType\s*:\s*(['"`])eslintrc\2\s*,([^}]*?)\}\s*\)/g
const LINTER_ESLINTRC_TRAILING_RE = /new\s+Linter\s*\(\s*\{([^}]*?),\s*configType\s*:\s*(['"`])eslintrc\2\s*\}\s*\)/g

const ESLINTRC_TODO = '/* TODO: configType "eslintrc" is removed in ESLint v10, flat config is now the only option */'

// ─── loadESLint: useFlatConfig option removed ────────────────────────────────
// loadESLint({ useFlatConfig: true/false }) → loadESLint()
const LOAD_ESLINT_RE = /loadESLint\s*\(\s*\{\s*useFlatConfig\s*:\s*(?:true|false)\s*\}\s*\)/g

// loadESLint({ useFlatConfig: true/false, ...rest }) → loadESLint({ ...rest })
const LOAD_ESLINT_LEADING_RE = /loadESLint\s*\(\s*\{([^}]*?)useFlatConfig\s*:\s*(?:true|false)\s*,([^}]*?)\}\s*\)/g
const LOAD_ESLINT_TRAILING_RE = /loadESLint\s*\(\s*\{([^}]*?),\s*useFlatConfig\s*:\s*(?:true|false)\s*\}\s*\)/g

// ─── ESLint flags array: remove removed flag values from flags: [...] only ───
const REMOVED_FLAGS = ['v10_config_lookup_from_file', 'unstable_config_lookup_from_file']
const FLAGS_ARRAY_RE = /\bflags\s*:\s*\[([^\]]*)\]/g

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
  result = result.replaceAll(LINTER_ESLINTRC_RE, `new Linter(${ESLINTRC_TODO})`)

  // 4. new Linter({ configType: 'eslintrc', ...rest }) → new Linter({ ...rest /* TODO */ })
  result = result.replaceAll(LINTER_ESLINTRC_LEADING_RE, (_m: string, before: string, _q: string, after: string) => {
    const b = before.trim().replace(/,\s*$/, '')
    const a = after.trim().replace(/^,\s*/, '')
    const parts = [b, a].filter(Boolean).join(', ')
    return parts ? `new Linter({ ${parts} ${ESLINTRC_TODO} })` : `new Linter(${ESLINTRC_TODO})`
  })
  result = result.replaceAll(LINTER_ESLINTRC_TRAILING_RE, (_m: string, before: string) => {
    const rest = before.trim().replace(/,\s*$/, '')
    return rest ? `new Linter({ ${rest} ${ESLINTRC_TODO} })` : `new Linter(${ESLINTRC_TODO})`
  })

  // 5. loadESLint({ useFlatConfig: ... }) → loadESLint()
  result = result.replaceAll(LOAD_ESLINT_RE, 'loadESLint()')

  // 6. loadESLint({ useFlatConfig: ..., ...rest }) → loadESLint({ ...rest })
  result = result.replaceAll(LOAD_ESLINT_LEADING_RE, (_m: string, before: string, after: string) => {
    const b = before.trim().replace(/,\s*$/, '')
    const a = after.trim().replace(/^,\s*/, '')
    const parts = [b, a].filter(Boolean).join(', ')
    return parts ? `loadESLint({ ${parts} })` : 'loadESLint()'
  })
  result = result.replaceAll(LOAD_ESLINT_TRAILING_RE, (_m: string, before: string) => {
    const rest = before.trim().replace(/,\s*$/, '')
    return rest ? `loadESLint({ ${rest} })` : 'loadESLint()'
  })

  // 7. Remove removed flag values — scoped to flags: [...] only to avoid touching unrelated strings
  result = result.replaceAll(FLAGS_ARRAY_RE, (_m: string, inner: string) => {
    let arr = inner
    for (const flag of REMOVED_FLAGS) {
      arr = arr.replaceAll(new RegExp(`(['"\`])${flag}\\1\\s*,?|,?\\s*(['"\`])${flag}\\2`, 'g'), '')
    }
    arr = arr
      .replace(/^\s*,\s*/, '')
      .replace(/,\s*$/, '')
      .replaceAll(/,\s*,/g, ',')
      .trim()
    return `flags: [${arr}]`
  })

  // 8. Deprecated Linter instance methods → TODO comment
  for (const method of DEPRECATED_METHODS) {
    result = result.replaceAll(
      new RegExp(`\\.${method}\\s*\\(`, 'g'),
      `.${method}(/* TODO: ${method}() removed in ESLint v10, no replacement */ `,
    )
  }

  return result === source ? null : result
}
