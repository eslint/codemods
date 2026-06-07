// errors/output as the first property triggers the trailing-comma removal branch
ruleTester.run('my-rule', rule, {
  valid: [
    { code: 'var x = 1' },
    { code: 'var y = 2', options: [{ strict: true }] },
  ],
})
