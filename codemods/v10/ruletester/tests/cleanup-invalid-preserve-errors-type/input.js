// type inside errors[] is removed; type in valid cases or unrelated objects is not touched
ruleTester.run('my-rule', rule, {
  valid: [
    // type in valid cases must not be touched (different script handles valid cases)
    { code: 'foo', options: [{ type: 'bar' }] },
  ],
  invalid: [
    // type inside errors[] must be removed
    { code: 'eval(x)', errors: [{ messageId: 'noEval', type: 'CallExpression' }] },
    // type in options must not be touched
    { code: 'eval(y)', options: [{ type: 'something' }], errors: [{ messageId: 'noEval' }] },
  ],
})
