ruleTester.run('my-rule', rule, {
  invalid: [
    // top-level type removed, type inside errors[i] must be preserved
    { code: 'eval(x)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    // type only inside errors[i] - must not be touched at all
    { code: 'eval(y)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    // multiple errors: type in first entry only
    {
      code: 'eval(z)',
      errors: [
        { messageId: 'noEval', type: 'CallExpression' },
        { messageId: 'noEval' },
      ],
    },
  ],
})
