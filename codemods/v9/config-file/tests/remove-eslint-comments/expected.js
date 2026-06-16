/* exported foo: true, bar: false */
/* exported foo bar */
/* eslint semi: ["error", "always"] */


foo(); // valid, because the configuration is "never"
