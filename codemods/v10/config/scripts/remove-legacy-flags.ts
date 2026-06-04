import { type SgRoot } from 'codemod:ast-grep'

// Env vars removed in ESLint v10
const REMOVED_ENV_VARS = ['ESLINT_USE_FLAT_CONFIG']

// ESLINT_FLAGS values to remove:
// - v10_config_lookup_from_file: removed in ESLint v10 (now the default behaviour)
// - unstable_config_lookup_from_file, unstable_ts_config: earlier aliases removed in ESLint v9.x
const REMOVED_FLAG_VALUES = ['v10_config_lookup_from_file', 'unstable_config_lookup_from_file', 'unstable_ts_config']

// CLI flags that take NO value (boolean flags)
const FLAGS_NO_VALUE = ['--no-eslintrc']

// CLI flags that consume the next argument as their value
const FLAGS_WITH_VALUE = ['--env', '--rulesdir', '--ignore-path', '--resolve-plugins-relative-to']

// Hex escapes for quote characters — avoids nesting quotes/backticks inside regex template literals.
// \x22 = "   \x27 = '   \x60 = `
const Q = '\\x22\\x27\\x60'

// A flag value token: either a quoted string (single/double/backtick) or an
// unquoted word that stops before whitespace and string delimiters.
const VALUE_TOKEN = `(?:\\x22[^\\x22]*\\x22|\\x27[^\\x27]*\\x27|\\x60[^\\x60]*\\x60|[^-\\s${Q}][^\\s${Q}]*)`

function removeEnvVarAssignments(source: string): string {
  let result = source

  for (const envVar of REMOVED_ENV_VARS) {
    // Handles:
    //   ESLINT_USE_FLAT_CONFIG=true ...
    //   export ESLINT_USE_FLAT_CONFIG=false ...
    //   export ESLINT_USE_FLAT_CONFIG=true && ...  (strip the dangling &&)
    result = result.replaceAll(
      new RegExp(
        // \\b before envVar prevents partial matches like MY_ESLINT_USE_FLAT_CONFIG
        `(export\\s+)?\\b${envVar}=(true|false|[^\\s${Q}]+|\\x22[^\\x22]*\\x22|\\x27[^\\x27]*\\x27|\\x60[^\\x60]*\\x60)\\s*(?:&&\\s*)?`,
        'g',
      ),
      '',
    )
  }

  return result
}

function removeFlagValues(source: string): string {
  let result = source

  for (const flag of REMOVED_FLAG_VALUES) {
    // Remove from comma-separated string: "flag1,v10_config_lookup_from_file,flag2" -> "flag1,flag-b"
    result = result.replaceAll(new RegExp(`,?\\b${flag}\\b,?`, 'g'), (match) => {
      // Keep one comma if both sides had one (flag was in the middle)
      if (match.startsWith(',') && match.endsWith(',')) return ','
      return ''
    })
  }

  return result
}

function removeEmptyFlagsAssignment(source: string): string {
  // After removeFlagValues strips all values, ESLINT_FLAGS= may be left with
  // nothing to assign. Remove the now-empty assignment entirely.
  return source.replaceAll(/(?:export\s+)?ESLINT_FLAGS=[ \t]*(?:&&\s*)?/g, '')
}

function removeCliFlags(source: string): string {
  let result = source

  for (const flag of FLAGS_NO_VALUE) {
    const escaped = flag.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // No value to consume — just remove the flag itself
    result = result.replaceAll(new RegExp(`\\s*${escaped}`, 'g'), '')
  }

  for (const flag of FLAGS_WITH_VALUE) {
    const escaped = flag.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Remove the flag and its value; value stops at quotes to avoid consuming string delimiters
    result = result.replaceAll(new RegExp(`\\s*${escaped}(\\s+${VALUE_TOKEN})?`, 'g'), '')
  }

  return result
}

export default async function transform(root: SgRoot): Promise<string | null> {
  const source = root.root().text()

  let result = source
  result = removeEnvVarAssignments(result)
  result = removeFlagValues(result)
  result = removeEmptyFlagsAssignment(result)
  result = removeCliFlags(result)

  return result === source ? null : result
}
