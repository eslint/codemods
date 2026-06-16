const { ESLint } = require('eslint/use-at-your-own-risk');
const { Linter } = require('eslint');

const eslint = new ESLint();
const linter = new Linter();

linter.verify('var x = 1', {
  languageOptions: {
    ecmaVersion: 6,
  },
});
