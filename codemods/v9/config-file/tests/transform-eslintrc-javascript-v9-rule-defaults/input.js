module.exports = {
  rules: {
    "no-implicit-coercion": "error",
    "no-inner-declarations": ["warn", "both"],
    "no-unused-vars": ["error", { caughtErrors: "all", varsIgnorePattern: "^_" }],
    "no-console": "error",
  },
};
