const { RuleTester } = require('eslint/use-at-your-own-risk');

const ruleTester = new RuleTester();

ruleTester.run('my-rule', rule, {
  valid: [
    {
      code: 'foo',
      languageOptions: {
        ecmaVersion: 6,
      },
    },
  ],
});
