export default [
  {
    rules: {
      // Deprecated "always" — safe to strip (this is the only effective behavior in v10)
      'radix': ['error', 'always'],
      'radix': ['warn', 'always'],
      'radix': [2, 'always'],
      // Deprecated "as-needed" — behavior changed, flag with TODO
      'radix': ['error', 'as-needed'],
      // No string option — must not be touched
      'radix': 'error',
      'radix': ['error'],
    },
  },
]
