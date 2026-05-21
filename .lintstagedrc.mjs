const LOCKFILE_SUFFIXES = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json']

/** @param {string[]} files */
function excludeLockfiles(files) {
  return files.filter((f) => !LOCKFILE_SUFFIXES.some((suffix) => f.endsWith(suffix)))
}

export default {
  '*.{ts,tsx,js,jsx,mts,mjs}': ['oxfmt --write', 'oxlint --type-aware --type-check --fix'],
  /** @param {string[]} files */
  '*.{json,yaml,yml}': (files) => {
    const filtered = excludeLockfiles(files)
    return filtered.length ? [`oxfmt --write ${filtered.join(' ')}`] : []
  },
  'codemods/**/scripts/**/*.ts': ["bash -c 'pnpm run test'"],
}
