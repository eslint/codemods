import { type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

// Matches: /* eslint-env browser */ or /* eslint-env node, browser */
// ESLint v10 throws a lint error when these are encountered.
const ESLINT_ENV_RE = /\/\*\s*eslint-env\b[^*]*\*\//g

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const source = root.root().text()

  if (!ESLINT_ENV_RE.test(source)) return null
  ESLINT_ENV_RE.lastIndex = 0

  // Process line by line so we can drop lines that contained ONLY the eslint-env comment
  const lines = source.split('\n')
  const result = lines
    .map((line) => {
      const stripped = line.replaceAll(ESLINT_ENV_RE, '')
      ESLINT_ENV_RE.lastIndex = 0
      // Only drop lines that changed AND became empty/whitespace-only
      // Blank lines that were already empty are preserved as-is
      if (line !== stripped && stripped.trim() === '') return null
      return stripped
    })
    .filter((line): line is string => line !== null)
    .join('\n')

  return result === source ? null : result
}
