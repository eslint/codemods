import { Linter } from 'eslint'

const linter = new Linter()

// All of these are removed in ESLint v10
linter.defineParser(/* TODO: defineParser() removed in ESLint v10, no replacement */ 'babel-eslint', require('babel-eslint'))
linter.defineRule(/* TODO: defineRule() removed in ESLint v10, no replacement */ 'my-rule', myRule)
linter.defineRules(/* TODO: defineRules() removed in ESLint v10, no replacement */ { 'rule-a': ruleA, 'rule-b': ruleB })
const rules = linter.getRules(/* TODO: getRules() removed in ESLint v10, no replacement */ )

// Normal method calls — must not be touched
linter.verify(code, config)
linter.verifyAndFix(code, config)
