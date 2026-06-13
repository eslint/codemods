// type inside errors[] is a valid node-type assertion and must NOT be removed.
// type in options must not be touched.
// Only top-level type on the invalid test case itself is removed.
ruleTester.run('my-rule', rule, {
  valid: [
    // type in options -- must not be touched
    { code: 'foo', options: [{ type: 'bar' }] },
  ],
  invalid: [
    // top-level type -- removed
    { code: 'eval(x)', errors: [{ messageId: 'noEval' }] },
    // type inside errors[] -- must NOT be removed (valid node assertion in v9)
    { code: 'eval(y)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    // type in options -- must not be touched
    { code: 'eval(z)', options: [{ type: 'something' }], errors: [{ messageId: 'noEval' }] },
    // top-level type + type inside errors[] -- only top-level removed
    {
      code: 'eval(w)',
      errors: [{ messageId: 'noEval', type: 'CallExpression' }],
    },
  ],
})
