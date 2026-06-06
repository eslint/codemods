export default [
  {
    rules: {
      // Extra 4th element no longer accepted in v10
      'func-names': ['error', 'always', {}],
      'func-names': ['warn', 'as-needed', {}],
      'func-names': [2, 'always', {}],
      // Non-empty options object (flat) — 4th element still removed
      'func-names': ['error', 'always', { generators: 'as-needed' }],
      // Nested options object — 4th element still removed
      'func-names': ['error', 'always', { generators: { mode: 'strict' } }],
      // Only 3 elements — must not be touched
      'func-names': ['error', 'always', {}],
      // Only severity — must not be touched
      'func-names': 'error',
    },
  },
]
