ruleTester.run('my-rule', rule, {
  invalid: [
    { code: 'eval(x)', type: 'CallExpression', errors: [{ messageId: 'noEval' }] },
    { code: 'with(x) {}', type: 'WithStatement', errors: [{ messageId: 'noWith' }] },
    { code: 'delete y', errors: [{ messageId: 'noDelete' }] },
  ],
})
