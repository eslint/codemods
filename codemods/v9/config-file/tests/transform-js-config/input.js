module.exports = {
  files: ["*.test.js", "*.spec.js", "**/__tests__/**/*.js"],

  env: {
    browser: true,
    es2021: true,
    node: true,
  },

  extends: ["eslint:recommended", "eslint:all"],

  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },

  globals: {
    myCustomGlobal: "readonly",
    jQuery: "readonly",
    $: "readonly",
    test: "test",
  },

  rules: {
    "require-jsdoc": [
      "warn",
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

    "valid-jsdoc": [
      "warn",
      {
        requireReturn: true,
        requireReturnType: true,
        requireParamDescription: true,
        requireReturnDescription: true,
        prefer: {
          return: "returns",
          arg: "param",
          argument: "param",
        },
        preferType: {
          Boolean: "boolean",
          Number: "number",
          String: "string",
          object: "Object",
        },
      },
    ],

    "no-constructor-return": "error",
    "no-constructor-return": ["error"],

    "no-sequences": [
      "error",
      {
        allowInParentheses: false,
      },
    ],
    "no-sequences": "error",

    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "lodash",
            message: "Please use lodash-es for better tree-shaking.",
          },
          {
            name: "moment",
            message:
              "Please use date-fns or dayjs instead - moment is quite heavy.",
          },
          {
            name: "axios",
            importNames: ["default"],
            message: "Please use fetch API instead.",
          },
        ],
        patterns: [
          {
            group: ["../*"],
            message: "Do not use parent relative imports.",
          },
        ],
      },
    ],

    "no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_",
      },
    ],

    "no-useless-computed-key": "error",
    "no-useless-computed-key": [
      "error",
      {
        enforceForClassMembers: true,
      },
    ],

    camelcase: [
      "error",
      {
        properties: "always",
        ignoreDestructuring: false,
        ignoreImports: false,
        ignoreGlobals: false,
        allow: ["^UNSAFE_", "^DEPRECATED_", "api_key", "user_id"],
      },
    ],

    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "no-debugger": "error",
    "no-alert": "warn",

    // Variable declarations
    "no-var": "error",
    "prefer-const": "error",
    "no-shadow": "error",
    "no-use-before-define": ["error", { functions: false, classes: true }],

    // Modern JavaScript
    "prefer-arrow-callback": "error",
    "arrow-body-style": ["error", "as-needed"],
    "object-shorthand": ["error", "always"],
    "quote-props": ["error", "as-needed"],
    "prefer-template": "error",
    "prefer-spread": "error",
    "prefer-rest-params": "error",
    "prefer-destructuring": [
      "error",
      {
        array: true,
        object: true,
      },
      {
        enforceForRenamedProperties: false,
      },
    ],

    // Best Practices
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-return-await": "error",
    "require-await": "error",
    "no-param-reassign": ["error", { props: false }],

    // Code Style
    indent: ["error", 2, { SwitchCase: 1 }],
    quotes: [
      "error",
      "single",
      { avoidEscape: true, allowTemplateLiterals: true },
    ],
    semi: ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "comma-spacing": ["error", { before: false, after: true }],
    "key-spacing": ["error", { beforeColon: false, afterColon: true }],
    "space-before-blocks": "error",
    "space-before-function-paren": [
      "error",
      { anonymous: "always", named: "never", asyncArrow: "always" },
    ],
    "space-infix-ops": "error",
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
    "no-multiple-empty-lines": ["error", { max: 2, maxEOF: 0, maxBOF: 0 }],
    "array-bracket-spacing": ["error", "never"],
    "object-curly-spacing": ["error", "always"],
    "max-len": ["warn", { code: 120, ignoreUrls: true, ignoreStrings: true }],
  },
  overrides: [
    {
      files: ["*.test.js", "*.spec.js", "**/__tests__/**/*.js"],
      env: {
        jest: true,
        mocha: true,
      },
      rules: {
        "no-console": "off",
        "require-jsdoc": "off",
        "max-len": "off",
      },
    },
    {
      files: ["*.config.js", "webpack.config.js", "vite.config.js"],
      env: {
        node: true,
      },
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["scripts/**/*.js"],
      rules: {
        "no-console": "off",
        "no-process-exit": "off",
      },
    },
  ],
};
