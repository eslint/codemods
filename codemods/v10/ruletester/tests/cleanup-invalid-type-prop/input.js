ruleTester.run('my-rule', rule, {
  invalid: [
    { code: 'eval(x)', type: 'CallExpression', errors: [{ messageId: 'noEval' }] },
    { code: 'with(x) {}', type: 'WithStatement', errors: [{ messageId: 'noWith' }] },
    { code: 'delete y', errors: [{ messageId: 'noDelete' }] },
    { code: 'eval(f)', type: 'CallExpression', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    {
      code: 'eval(g)',
      type: 'CallExpression',
      errors: [
        { messageId: 'noEval', type: 'CallExpression' },
        { messageId: 'noEval' },
      ],
    },
  ],
})
