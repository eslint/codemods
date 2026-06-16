const { FlatESLint } = require('eslint/use-at-your-own-risk');
const { Linter } = require('eslint');

const eslint = new FlatESLint();
const linter = new Linter();

linter.verify('var x = 1', {
  parserOptions: {
    ecmaVersion: 6,
  },
});
