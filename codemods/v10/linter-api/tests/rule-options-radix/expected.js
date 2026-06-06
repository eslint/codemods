export default [
  {
    rules: {
      // Deprecated "always" — safe to strip (this is the only effective behavior in v10)
      'radix': 'error',
      'radix': 'warn',
      'radix': 2,
      // Deprecated "as-needed" — behavior changed, flag with TODO
      'radix': ['error', /* TODO: "as-needed" is removed in ESLint v10 — remove the "as-needed" option or disable the rule */ 'as-needed'],
      // No string option — must not be touched
      'radix': 'error',
      'radix': ['error'],
    },
  },
]
