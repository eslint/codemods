// output with a non-null string value must still be removed from valid cases
ruleTester.run('my-rule', rule, {
  valid: [
    { code: 'var x = 1' },
    { code: 'var y = 2' },
  ],
})
