ruleTester.run('my-rule', rule, {
  valid: [
    { code: 'var x = 1' },
    { code: 'var y = 2' },
    { code: 'var z = 3' },
    { code: 'var w = 4' },
  ],
})
