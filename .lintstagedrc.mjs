const LOCKFILE_SUFFIXES = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json']
const TEST_DIR_RE = /[/\\]tests[/\\]/

/** @param {string[]} files */
function excludeLockfiles(files) {
  return files.filter((f) => !LOCKFILE_SUFFIXES.some((suffix) => f.endsWith(suffix)))
}

export default {
  '*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}': 'oxfmt --write',
  // oxlint ignorePatterns excludes **/tests — skip test fixtures upfront to avoid "no files" error
  /** @param {string[]} files */
  '*.{js,mjs,cjs,jsx}': (files) => {
    const toCheck = files.filter((f) => !TEST_DIR_RE.test(f))
    return toCheck.length ? [`oxlint --fix ${toCheck.join(' ')}`] : []
  },
  '*.{ts,mts,cts,tsx}': 'oxlint --type-aware --type-check --fix',
  /** @param {string[]} files */
  '*.{json,yaml,yml}': (files) => {
    // oxfmt errors when all files are excluded by ignorePatterns; skip test fixtures upfront
    const filtered = excludeLockfiles(files).filter((f) => !TEST_DIR_RE.test(f))
    return filtered.length ? [`oxfmt --write ${filtered.join(' ')}`] : []
  },
  'codemods/**/scripts/**/*.ts': ["bash -c 'pnpm run test'"],
}
