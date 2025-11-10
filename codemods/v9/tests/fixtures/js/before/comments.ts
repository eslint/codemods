/* exported foo: true, bar: false */
/* exported foo bar */
/* eslint semi: ["error", "always"] */
/* eslint semi: ["error", "never"] */

foo(); // valid, because the configuration is "never"
