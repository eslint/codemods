/** Local consts merged into rules via spreads and identifier values (CommonJS eslintrc). */
const baseRules = {
  "no-console": "warn",
};

const eqeqeqSeverity = "error";

module.exports = {
  env: {
    node: true,
  },
  extends: ["eslint:recommended"],
  rules: {
    ...baseRules,
    eqeqeq: eqeqeqSeverity,
  },
};
