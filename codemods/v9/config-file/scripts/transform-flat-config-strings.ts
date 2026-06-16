import { parse, type Edit, type SgNode, type SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const PRESET_TO_JS_CONFIG: Record<string, string> = {
  'eslint:recommended': 'js.configs.recommended',
  'eslint:all': 'js.configs.all',
}

const hasJsImport = (rootNode: SgNode<JS>): boolean =>
  !!rootNode.find({
    rule: {
      kind: 'import_statement',
      has: {
        kind: 'string_fragment',
        regex: '^@eslint/js$',
      },
    },
  })

const buildJsImport = (): string => `import js from '@eslint/js';\n`

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []

  const presetStrings = rootNode.findAll({
    rule: {
      kind: 'string',
      has: {
        kind: 'string_fragment',
        regex: '^(eslint:recommended|eslint:all)$',
      },
    },
  })

  for (const preset of presetStrings) {
    const presetName = preset.find({ rule: { kind: 'string_fragment' } })?.text() ?? ''
    const replacement = PRESET_TO_JS_CONFIG[presetName]
    if (replacement) {
      edits.push(preset.replace(replacement))
    }
  }

  if (edits.length === 0) {
    return null
  }

  let nextSource = rootNode.commitEdits(edits)
  const nextRoot = parse('javascript', nextSource).root() as unknown as SgNode<JS>

  if (!hasJsImport(nextRoot)) {
    const firstImport = nextRoot.find({
      rule: {
        kind: 'import_statement',
      },
    })

    if (firstImport) {
      nextSource = nextRoot.commitEdits([
        {
          startPos: firstImport.range().start.index,
          endPos: firstImport.range().start.index,
          insertedText: buildJsImport(),
        },
      ])
    } else {
      nextSource = `${buildJsImport()}${nextSource}`
    }
  }

  return nextSource === rootNode.text() ? null : nextSource
}
