const LOCKFILE_SUFFIXES = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json']

/** @param {string[]} files */
function excludeLockfiles(files) {
  return files.filter((f) => !LOCKFILE_SUFFIXES.some((suffix) => f.endsWith(suffix)))
}

export default {
  '*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}': 'oxfmt --write',
  '*.{js,mjs,cjs,jsx}': 'oxlint --fix',
  '*.{ts,mts,cts,tsx}': 'oxlint --type-aware --type-check --fix',
  /** @param {string[]} files */
  '*.{json,yaml,yml}': (files) => {
    // oxfmt errors when all files are excluded by ignorePatterns; skip test fixtures upfront
    const filtered = excludeLockfiles(files).filter((f) => !/[/\\]tests[/\\]/.test(f))
    return filtered.length ? [`oxfmt --write ${filtered.join(' ')}`] : []
  },
  'codemods/**/scripts/**/*.ts': ["bash -c 'pnpm run test'"],
}
