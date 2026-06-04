import { type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// func-names: ESLint v10 no longer accepts a 4th array element (the trailing mode string).
// The valid schema is [severity, mode?, options?] — a 4th element is rejected.
// Before: ["error", "always", {}, "as-needed"]
// After:  ["error", "always", {}]
// Pattern: severity , mode_string , options_object , extra_mode_string ]
const FUNC_NAMES_RE =
  /(['"`]func-names['"`]\s*:\s*\[)(\s*(?:'[^']*'|"[^"]*"|`[^`]*`|\d+)\s*,\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*,\s*\{[^}]*\})\s*,\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*(\])/g

// no-invalid-regexp: ESLint v10 rejects duplicate flags in allowConstructorFlags.
// Before: { allowConstructorFlags: ["u", "y", "u"] }
// After:  { allowConstructorFlags: ["u", "y"] }
const ALLOW_CONSTRUCTOR_FLAGS_RE = /allowConstructorFlags\s*:\s*\[([^\]]+)\]/g

// radix: string options "always" and "as-needed" are deprecated in v10.
// "always" is the only effective behavior now, so it can be stripped.
// Before: 'radix': ['error', 'always']
// After:  'radix': 'error'
const RADIX_ALWAYS_RE = /(['"`]radix['"`]\s*:\s*)\[(\s*(?:'[^']*'|"[^"]*"|`[^`]*`|\d+)\s*),\s*(['"`])always\3\s*\]/g

// "as-needed" changed behavior — flag with TODO.
// Before: 'radix': ['error', 'as-needed']
// After:  'radix': ['error', /* TODO */ 'as-needed']
const RADIX_AS_NEEDED_RE = /(['"`]radix['"`]\s*:\s*\[\s*(?:'[^']*'|"[^"]*"|`[^`]*`|\d+)\s*)(,\s*)(['"`])as-needed\3/g

function deduplicateFlags(match: string, inner: string): string {
  const flags = inner.match(/['"`][^'"`]*['"`]/g) ?? []
  const seen = new Set<string>()
  const unique = flags.filter((f) => {
    const key = f.replaceAll(/['"` ]/g, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length === flags.length) return match
  return `allowConstructorFlags: [${unique.join(', ')}]`
}

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const source = root.root().text()
  let result = source

  // 1. Remove extra 4th element from func-names array config
  result = result.replaceAll(FUNC_NAMES_RE, (_match, open, body, close) => `${open}${body}${close}`)

  // 2. Deduplicate allowConstructorFlags in no-invalid-regexp
  result = result.replaceAll(ALLOW_CONSTRUCTOR_FLAGS_RE, deduplicateFlags)

  // 3. radix "always": strip the redundant option (default behavior in v10)
  result = result.replaceAll(
    RADIX_ALWAYS_RE,
    (_: string, prefix: string, severity: string) => `${prefix}${severity.trim()}`,
  )

  // 4. radix "as-needed": flag with TODO — the option is deprecated and behavior changed
  result = result.replaceAll(
    RADIX_AS_NEEDED_RE,
    (_: string, open: string, sep: string, q: string) =>
      `${open}${sep}/* TODO: radix "as-needed" option is deprecated in ESLint v10 — the rule now always enforces providing the radix argument */ ${q}as-needed${q}`,
  )

  return result === source ? null : result
}
