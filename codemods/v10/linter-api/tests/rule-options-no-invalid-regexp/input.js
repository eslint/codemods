export default [
  {
    rules: {
      // Duplicate flags rejected in v10
      'no-invalid-regexp': ['error', { allowConstructorFlags: ['u', 'y', 'u'] }],
      'no-invalid-regexp': ['error', { allowConstructorFlags: ['g', 'i', 'g', 'm'] }],
      'no-invalid-regexp': ['error', { allowConstructorFlags: ['u', 'u', 'u'] }],
      // No duplicates — must not be touched
      'no-invalid-regexp': ['error', { allowConstructorFlags: ['u', 'y'] }],
      // No options — must not be touched
      'no-invalid-regexp': 'error',
    },
  },
]
