export default [
  {
    rules: {
      // Extra 4th element no longer accepted in v10
      'func-names': ['error', 'always', {}, 'as-needed'],
      'func-names': ['warn', 'as-needed', {}, 'always'],
      'func-names': [2, 'always', {}, 'never'],
      // Only 3 elements — must not be touched
      'func-names': ['error', 'always', {}],
      // Only severity — must not be touched
      'func-names': 'error',
    },
  },
]
