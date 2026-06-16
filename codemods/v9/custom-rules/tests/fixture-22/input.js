const { FlatRuleTester } = require('eslint/use-at-your-own-risk');

const ruleTester = new FlatRuleTester();

ruleTester.run('my-rule', rule, {
  valid: [
    {
      code: 'foo',
      parserOptions: {
        ecmaVersion: 6,
      },
      output: 'foo',
    },
  ],
});
