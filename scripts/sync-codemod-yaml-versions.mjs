#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const versionPattern = /^version:\s*(['"]?)([^'"\n]+)\1\s*$/m

const yamlPaths = execSync("find codemods -path '*/node_modules/*' -prune -o -name codemod.yaml -print", {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((path) => path !== '')

for (const relativePath of yamlPaths) {
  const dir = join(root, dirname(relativePath))
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const yamlPath = join(dir, 'codemod.yaml')
  const content = readFileSync(yamlPath, 'utf8')
  const updated = content.replace(versionPattern, `version: '${version}'`)

  if (updated !== content) {
    writeFileSync(yamlPath, updated)
    console.log(`${relativePath} -> ${version}`)
  }
}
