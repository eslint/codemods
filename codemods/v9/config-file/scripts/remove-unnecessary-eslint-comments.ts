import type { Edit, SgRoot } from 'codemod:ast-grep'
import type JS from 'codemod:ast-grep/langs/javascript'

const ESLINT_CONFIG_COMMENT = /^\/\*\s*eslint\s+(?!disable(?:-next-line|-line)?)(?!enable)([\s\S]*?)\s*\*\/$/

type RuleSegment = {
  name: string
  text: string
}

const skipWhitespace = (body: string, index: number): number => {
  while (index < body.length && /\s/.test(body[index] ?? '')) {
    index += 1
  }
  return index
}

const skipString = (body: string, index: number): number => {
  const quote = body[index]
  index += 1
  while (index < body.length) {
    if (body[index] === '\\') {
      index += 2
      continue
    }
    if (body[index] === quote) {
      return index + 1
    }
    index += 1
  }
  return index
}

const skipBalanced = (body: string, index: number, open: string, close: string): number => {
  let depth = 0
  while (index < body.length) {
    const char = body[index]
    if (char === '"' || char === "'") {
      index = skipString(body, index)
      continue
    }
    if (char === open) {
      depth += 1
    } else if (char === close) {
      depth -= 1
      if (depth === 0) {
        return index + 1
      }
    }
    index += 1
  }
  return index
}

const skipRuleValue = (body: string, index: number): number => {
  index = skipWhitespace(body, index)
  const char = body[index]
  if (char === '"' || char === "'") {
    return skipString(body, index)
  }
  if (char === '[') {
    return skipBalanced(body, index, '[', ']')
  }
  if (char === '{') {
    return skipBalanced(body, index, '{', '}')
  }
  while (index < body.length && !/[\s,]/.test(body[index] ?? '')) {
    index += 1
  }
  return index
}

const parseRuleSegments = (body: string): RuleSegment[] => {
  const segments: RuleSegment[] = []
  let index = 0

  while (index < body.length) {
    index = skipWhitespace(body, index)
    if (index >= body.length) {
      break
    }

    const segmentStart = index
    const nameMatch = body.slice(index).match(/^[\w/@-]+/)
    if (!nameMatch) {
      break
    }

    const name = nameMatch[0]
    index += name.length
    index = skipWhitespace(body, index)

    if (body[index] !== ':') {
      break
    }

    index += 1
    index = skipRuleValue(body, index)
    index = skipWhitespace(body, index)

    if (body[index] === ',') {
      index += 1
    }

    segments.push({
      name,
      text: body.slice(segmentStart, index).trim().replace(new RegExp(',\\s+$'), ''),
    })
  }

  return segments
}

const rebuildEslintComment = (segments: RuleSegment[]): string =>
  `/* eslint ${segments.map((segment) => segment.text).join(', ')} */`

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root()
  const edits: Edit[] = []
  const seenRules = new Set<string>()

  const eslintComments = rootNode.findAll({
    rule: {
      kind: 'comment',
      regex: String.raw`^\/\*\s*eslint\s+[\w\/@-]+\s*:[\s\S]*\*\/$`,
    },
  })

  for (const comment of eslintComments) {
    const commentText = comment.text()
    const match = commentText.match(ESLINT_CONFIG_COMMENT)
    if (!match) {
      continue
    }

    const segments = parseRuleSegments(match[1] ?? '')
    const keptSegments = segments.filter((segment) => {
      if (seenRules.has(segment.name)) {
        return false
      }
      seenRules.add(segment.name)
      return true
    })

    if (keptSegments.length === 0) {
      edits.push(comment.replace(''))
      continue
    }

    if (keptSegments.length !== segments.length) {
      edits.push(comment.replace(rebuildEslintComment(keptSegments)))
    }
  }

  if (edits.length === 0) {
    return null
  }

  return rootNode.commitEdits(edits)
}
