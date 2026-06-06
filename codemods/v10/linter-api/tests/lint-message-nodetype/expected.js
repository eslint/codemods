import { Linter } from 'eslint'

const linter = new Linter()
const messages = linter.verify(code, config)

// nodeType as a trailing property
assert.deepEqual(messages[0], {
  ruleId: 'no-var',
  severity: 2,
  message: 'Unexpected var, use let or const instead.',
})

// nodeType as a leading property
assert.deepEqual(messages[0], {
  message: 'some error',
  line: 1,
})

// nodeType as the only property
assert.deepEqual(messages[0], {  })

// nodeType in a nested array of expected messages
assert.deepEqual(messages, [
  { message: 'error 1', line: 1 },
  { message: 'error 2', line: 2 },
])

// member expression accesses — flagged with TODO
const type = messages[0].nodeType /* TODO: LintMessage.nodeType was removed in ESLint v10 — remove this usage */
if (messages[0].nodeType /* TODO: LintMessage.nodeType was removed in ESLint v10 — remove this usage */ === 'Identifier') {
  console.log('identifier')
}
