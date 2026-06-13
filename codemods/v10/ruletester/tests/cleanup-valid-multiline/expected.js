// multiline valid cases with errors/output on their own lines
ruleTester.run('my-rule', rule, {
  valid: [
    {
      code: 'var x = 1',
      options: [{ foo: true }],
    },
    {
      code: 'var y = 2',
    },
  ],
})
