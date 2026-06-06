// errors/output keys that appear inside options items or nested sub-objects must NOT be
// removed - the selector is anchored to the direct valid-array object level
ruleTester.run('my-rule', rule, {
  valid: [
    // errors inside options: selector must not reach into options sub-objects
    { code: 'foo', options: [{ errors: ['value must not be empty'] }] },
    // output inside options: same rule
    { code: 'bar', options: [{ output: 'expected output value' }] },
    // both nested and top-level present: only the top-level ones are removed
    {
      code: 'baz',
      options: [{ errors: ['something'], output: 'transformed' }],
    },
  ],
})
