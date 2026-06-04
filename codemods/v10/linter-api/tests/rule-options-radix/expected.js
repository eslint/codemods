export default [
  {
    rules: {
      // Deprecated "always" — safe to strip (this is the only effective behavior in v10)
      'radix': 'error',
      'radix': 'warn',
      'radix': 2,
      // Deprecated "as-needed" — behavior changed, flag with TODO
      'radix': ['error', /* TODO: radix "as-needed" option is deprecated in ESLint v10 — the rule now always enforces providing the radix argument */ 'as-needed'],
      // No string option — must not be touched
      'radix': 'error',
      'radix': ['error'],
    },
  },
]
