// errors/output in the invalid section must be left alone; only valid cases are cleaned up
ruleTester.run('my-rule', rule, {
  valid: [
    { code: 'var x = 1' },
  ],
  invalid: [
    { code: 'eval(x)', errors: [{ messageId: 'noEval' }], output: 'eval(x)' },
  ],
})
