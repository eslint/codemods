// string shorthand valid cases (bare strings, not objects) must be left untouched;
// only object cases with errors/output properties are transformed
ruleTester.run('my-rule', rule, {
  valid: [
    'var x = 1',
    { code: 'var y = 2' },
    'var z = 3',
    { code: 'var w = 4' },
  ],
})
