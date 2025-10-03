module.exports = {
    env: {
      browser: true,
      es2021: true,
      node: true,
    },
    
    // ✅ 1. "eslint:recommended" و "eslint:all" در .eslintrc.js کار می‌کنند
    // (در flat config v9 حذف شده‌اند)
    extends: [
      'eslint:recommended',
      'eslint:all', // اگر بخواهید همه قوانین رو فعال کنید
    ],
    
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    
    // ✅ 2. globals به صورت object تعریف می‌شود (در v9 فرمت متفاوته)
    globals: {
      myCustomGlobal: 'readonly',
      jQuery: 'readonly',
      $: 'readonly',
    },
    
    rules: {
      // ========================================================================================
      // ✅ 3. require-jsdoc و valid-jsdoc - در v9 حذف شده‌اند
      // ========================================================================================
      'require-jsdoc': [
        'warn',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      
      'valid-jsdoc': [
        'warn',
        {
          requireReturn: true,
          requireReturnType: true,
          requireParamDescription: true,
          requireReturnDescription: true,
          prefer: {
            return: 'returns',
            arg: 'param',
            argument: 'param',
          },
          preferType: {
            Boolean: 'boolean',
            Number: 'number',
            String: 'string',
            object: 'Object',
          },
        },
      ],
      
      // ========================================================================================
      // ✅ 4. no-constructor-return - schema در v9 سخت‌تر شده
      // ========================================================================================
      'no-constructor-return': 'error',
      'no-constructor-return': ['error'],
      
      // ========================================================================================
      // ✅ 5. no-sequences - schema در v9 سخت‌تر شده
      // ========================================================================================
      'no-sequences': [
        'error',
        {
          allowInParentheses: false, // در v8 می‌توانید این را تنظیم کنید
        },
      ],
      'no-sequences': 'error',
      
      // ========================================================================================
      // ✅ 6. no-restricted-imports - در v9 می‌توان چندین entry با name یکسان داشت
      // در v8 هم کار می‌کند ولی در v9 بهتر شده
      // ========================================================================================
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lodash',
              message: 'لطفاً از lodash-es برای tree-shaking بهتر استفاده کنید.',
            },
            {
              name: 'moment',
              message: 'لطفاً از date-fns یا dayjs استفاده کنید - moment خیلی سنگینه.',
            },
            {
              name: 'axios',
              importNames: ['default'],
              message: 'لطفاً از fetch API استفاده کنید.',
            },
          ],
          patterns: [
            {
              group: ['../*'],
              message: 'از relative imports والد استفاده نکنید.',
            },
          ],
        },
      ],
      
      // ========================================================================================
      // ✅ 7. no-unused-vars - در v9 پیش‌فرض caughtErrors برابر "all" شده
      // در v8 باید صریحاً تنظیم کنید
      // ========================================================================================
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          caughtErrors: 'all', // در v8 پیش‌فرض "none" بود، در v9 شده "all"
          caughtErrorsIgnorePattern: '^_', // error های با _ شروع شوند ignore میشن
        },
      ],
      
      // ========================================================================================
      // ✅ 8. no-useless-computed-key - در v9 پیش‌فرض enforceForClassMembers برابر true شده
      // در v8 باید صریحاً فعالش کنید
      // ========================================================================================
      'no-useless-computed-key': [
        'error',
        {
          enforceForClassMembers: true, // در v8 پیش‌فرض false بود، در v9 شده true
        },
      ],
      
      // ========================================================================================
      // ✅ 9. camelcase - در v9 فقط array قبول می‌کند، در v8 object هم قبول می‌کرد
      // ========================================================================================
      camelcase: [
        'error',
        {
          properties: 'always',
          ignoreDestructuring: false,
          ignoreImports: false,
          ignoreGlobals: false,
          // در v8 می‌توانست object باشد، در v9 باید array باشد
          allow: ['^UNSAFE_', '^DEPRECATED_', 'api_key', 'user_id'], // فرمت array
        },
      ],
      
      // ========================================================================================
      // قوانین اضافی مفید برای v8
      // ========================================================================================
      
      // Console و Debugging
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      
      // Variable declarations
      'no-var': 'error',
      'prefer-const': 'error',
      'no-shadow': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true }],
      
      // Modern JavaScript
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': ['error', 'always'],
      'quote-props': ['error', 'as-needed'],
      'prefer-template': 'error',
      'prefer-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: true,
          object: true,
        },
        {
          enforceForRenamedProperties: false,
        },
      ],
      
      // Best Practices
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-param-reassign': ['error', { props: false }],
      
      // Code Style
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'comma-spacing': ['error', { before: false, after: true }],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'space-infix-ops': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0, maxBOF: 0 }],
      'array-bracket-spacing': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    },
    
    // ========================================================================================
    // ✅ 10. overrides برای فایل‌های خاص (در v9 به files تبدیل شده)
    // ========================================================================================
    overrides: [
      {
        files: ['*.test.js', '*.spec.js', '**/__tests__/**/*.js'],
        env: {
          jest: true,
          mocha: true,
        },
        rules: {
          'no-console': 'off',
          'require-jsdoc': 'off',
          'max-len': 'off',
        },
      },
      {
        files: ['*.config.js', 'webpack.config.js', 'vite.config.js'],
        env: {
          node: true,
        },
        rules: {
          'no-console': 'off',
        },
      },
      {
        files: ['scripts/**/*.js'],
        rules: {
          'no-console': 'off',
          'no-process-exit': 'off',
        },
      },
    ],
  };
  