import path from 'node:path'

import type { SgRoot } from 'codemod:ast-grep'
import { parse } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'
import type JSONLang from 'codemod:ast-grep/langs/json'
import type YAML from 'codemod:ast-grep/langs/yaml'

import jsTransform from './transform-js-config.ts'
import jsonTransform from './transform-json-config.ts'

async function transform(root: SgRoot<YAML | JSONLang | JS>): Promise<string | null> {
  const text = root.root().text()
  const fileName = root.filename()
  const basename = path.basename(fileName)
  const fileExtension = basename.split('.').pop()?.toLowerCase()

  const isStandardEslintrc = /\.eslintrc\.(js|mjs|cjs|json|yaml|yml)$/.test(basename)
  if (isStandardEslintrc) {
    root.rename('eslint.config.mjs')
  }

  if (fileExtension === 'js' || fileExtension === 'cjs' || fileExtension === 'mjs') {
    return jsTransform(root as unknown as SgRoot<JS>)
  }
  if (fileExtension === 'json') {
    return jsonTransform(root as unknown as SgRoot<JSONLang>)
  }
  if (fileExtension === 'yaml' || fileExtension === 'yml') {
    // Lazy load js-yaml to improve performance for users who don't have YAML config files.
    const jsYaml = await import('js-yaml').then(module => module.default)
    const yamlObject = jsYaml.load(text)
    const jsonRoot = parse('json', JSON.stringify(yamlObject)) as unknown as SgRoot<JSONLang>
    return jsonTransform(jsonRoot as unknown as SgRoot<JSONLang>)
  }

  return null
}

export default transform
