ruleTester.run('my-rule', rule, {
  invalid: [
    { code: 'eval(x)', errors: [{ messageId: 'noEval' }] },
    { code: 'with(x) {}', errors: [{ messageId: 'noWith' }] },
    { code: 'delete y', errors: [{ messageId: 'noDelete' }] },
    { code: 'eval(f)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    {
      code: 'eval(g)',
      errors: [
        { messageId: 'noEval', type: 'CallExpression' },
        { messageId: 'noEval' },
      ],
    },
  ],
})
