// Real pattern from eslint-plugin-import and eslint-plugin-promise:
// test cases generated via array.map() spread into invalid: [].
// The codemod must remove `type` from inside the map() callback object.
ruleTester.run('my-rule', rule, {
  valid: [],
  invalid: [
    // Direct object (baseline)
    {
      type: 'CallExpression',
      code: 'eval(x)',
      errors: [{ messageId: 'noEval' }],
    },

    // map() spread -- type inside arrow-function-returned object
    ...['eval(a)', 'eval(b)', 'eval(c)'].map((code) => ({
      type: 'CallExpression',
      code,
      errors: [{ messageId: 'noEval' }],
    })),

    // map() with index parameter
    ...cases.map((code, i) => ({
      type: 'Identifier',
      code,
      errors: [{ message: `Error ${i}` }],
    })),

    // No type -- must NOT be modified
    { code: 'safe()', errors: [{ messageId: 'noSafe' }] },

    // type inside errors[] inside map() -- must NOT be removed
    ...errorCases.map((code) => ({
      code,
      errors: [{ messageId: 'err', type: 'CallExpression' }],
    })),
  ],
})
