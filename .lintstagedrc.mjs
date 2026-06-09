const LOCKFILE_SUFFIXES = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json']
const TEST_DIR_RE = /[/\\]tests[/\\]/

/** @param {string[]} files */
function excludeLockfiles(files) {
  return files.filter((f) => !LOCKFILE_SUFFIXES.some((suffix) => f.endsWith(suffix)))
}

export default {
  '*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,md}': 'oxfmt --write --no-error-on-unmatched-pattern',
  '*.{js,mjs,cjs,jsx}': 'oxlint --fix --no-error-on-unmatched-pattern',
  '*.{ts,mts,cts,tsx}': 'oxlint --type-aware --type-check --fix --no-error-on-unmatched-pattern',
  /** @param {string[]} files */
  '*.{json,yaml,yml}': (files) => {
    const filtered = excludeLockfiles(files)
    return filtered.length ? [`oxfmt --write --no-error-on-unmatched-pattern ${filtered.join(' ')}`] : []
  },
  'codemods/**/scripts/**/*.ts': ["bash -c 'pnpm run test'"],
}
