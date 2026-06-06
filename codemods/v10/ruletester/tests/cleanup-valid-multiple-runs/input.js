// all ruleTester.run() calls in the same file must be transformed
ruleTester.run('rule-one', rule1, {
  valid: [
    { code: 'foo', errors: [] },
  ],
})

ruleTester.run('rule-two', rule2, {
  valid: [
    { code: 'bar', output: null },
    { code: 'baz', errors: [{ messageId: 'noop' }], output: null },
  ],
})
