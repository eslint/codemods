// real v9 valid cases carry name, filename, parserOptions, settings, env - all must be
// preserved after errors/output are stripped
ruleTester.run('my-rule', rule, {
  valid: [
    {
      name: 'simple variable declaration',
      code: 'var x = 1',
      errors: [],
    },
    {
      code: 'const fn = () => {}',
      filename: 'test.ts',
      errors: [],
      output: null,
    },
    {
      code: 'foo',
      parserOptions: { ecmaVersion: 2020 },
      errors: [],
    },
    {
      code: 'bar',
      settings: { myPlugin: { version: 1 } },
      env: { browser: true },
      errors: [{ messageId: 'noBar' }],
      output: null,
    },
  ],
})
