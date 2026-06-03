ruleTester.run('my-rule', rule, {
  valid: [
    { code: 'var x = 1', errors: [], output: null },
    { code: 'var y = 2', errors: [] },
    { code: 'var z = 3', output: null },
    { code: 'var w = 4' },
  ],
})
