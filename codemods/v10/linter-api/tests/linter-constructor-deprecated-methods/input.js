import { Linter } from 'eslint'

const linter = new Linter()

// All of these are removed in ESLint v10
linter.defineParser('babel-eslint', require('babel-eslint'))
linter.defineRule('my-rule', myRule)
linter.defineRules({ 'rule-a': ruleA, 'rule-b': ruleB })
const rules = linter.getRules()

// Normal method calls — must not be touched
linter.verify(code, config)
linter.verifyAndFix(code, config)
