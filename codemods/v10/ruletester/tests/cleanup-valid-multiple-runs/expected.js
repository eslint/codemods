// all ruleTester.run() calls in the same file must be transformed
ruleTester.run('rule-one', rule1, {
  valid: [
    { code: 'foo' },
  ],
})

ruleTester.run('rule-two', rule2, {
  valid: [
    { code: 'bar' },
    { code: 'baz' },
  ],
})
