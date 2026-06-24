import path from 'node:path'

import type { SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'
import { acquireLock, getState, setState } from 'codemod:workflow'

async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const source = rootNode.text()
  const directory = path.dirname(root.filename()).replaceAll(/[/\\]/g, '-')
  const stateKey = `ignoreFiles-${directory}`
  const release = acquireLock(stateKey)
  try {
    const beforeIgnoreFiles = getState<string[]>(stateKey) ?? []
    let ignoreFiles = [
      ...beforeIgnoreFiles,
      ...source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    ]
    ignoreFiles = ignoreFiles
      .filter((file) => !file.startsWith('#'))
      .filter((file, index, self) => self.indexOf(file) === index)
      .map((file) => `"${file}"`)
    setState(stateKey, ignoreFiles)
  } finally {
    release()
  }

  const currentWorkingDirectory = process.cwd()
  const fileName = root.filename()
  const fileDirectory = path.dirname(fileName)
  const relativePath = fileDirectory !== currentWorkingDirectory ? '../' : ''
  root.rename(path.join(relativePath, 'deleted-eslintignore-backup.txt'))

  return null
}

export default transform
