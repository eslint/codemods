ruleTester.run('my-rule', rule, {
  invalid: [
    // top-level type as first property (trailing comma path)
    { type: 'CallExpression', code: 'eval(x)', errors: [{ messageId: 'noEval' }] },
    // top-level type in the middle
    { code: 'eval(y)', type: 'CallExpression', errors: [{ messageId: 'noEval' }] },
    // top-level type as last property (preceding comma path)
    { code: 'eval(z)', errors: [{ messageId: 'noEval' }], type: 'CallExpression' },
    // no top-level type -- must not be changed
    { code: 'eval(w)', errors: [{ messageId: 'noEval' }] },
    // type inside errors[] -- must NOT be touched (node-type assertion, valid in v9)
    { code: 'eval(v)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    // multiline with top-level type
    {
      type: 'CallExpression',
      code: 'eval(a)',
      errors: [{ messageId: 'noEval' }],
    },
  ],
})
