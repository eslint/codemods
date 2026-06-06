const LOCKFILE_SUFFIXES = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json']

/** @param {string[]} files */
function excludeLockfiles(files) {
  return files.filter((f) => !LOCKFILE_SUFFIXES.some((suffix) => f.endsWith(suffix)))
}

export default {
  /** @param {string[]} files */
  '*.{ts,tsx,js,jsx,mts,mjs}': (files) => {
    const formattable = files.filter((f) => !f.includes('\/tests\/'))
    const cmds = []
    if (formattable.length) {cmds.push(`oxfmt --write ${formattable.join(' ')}`)}
    cmds.push(`oxlint --type-aware --type-check --fix ${files.join(' ')}`)
    return cmds
  },
  /** @param {string[]} files */
  '*.{json,yaml,yml}': (files) => {
    const filtered = excludeLockfiles(files)
    return filtered.length ? [`oxfmt --write ${filtered.join(' ')}`] : []
  },
  'codemods/**/scripts/**/*.ts': ["bash -c 'pnpm run test'"],
}
