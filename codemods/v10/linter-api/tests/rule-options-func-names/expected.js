export default [
  {
    rules: {
      // Extra 4th element no longer accepted in v10
      'func-names': ['error', 'always', {}],
      'func-names': ['warn', 'as-needed', {}],
      'func-names': [2, 'always', {}],
      // Only 3 elements — must not be touched
      'func-names': ['error', 'always', {}],
      // Only severity — must not be touched
      'func-names': 'error',
    },
  },
]
