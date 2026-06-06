ruleTester.run('my-rule', rule, {
  invalid: [
    { code: 'eval(x)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    { code: 'with(x) {}', errors: [{ messageId: 'noWith', type: 'WithStatement' }] },
    { code: 'delete y', errors: [{ messageId: 'noDelete' }] },
    {
      code: 'eval(g)',
      errors: [
        { messageId: 'noEval', type: 'CallExpression' },
        { messageId: 'noEval' },
      ],
    },
  ],
})
