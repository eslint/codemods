import { defineConfig } from "eslint/config";
import { jsdoc } from "eslint-plugin-jsdoc";
import js from "@eslint/js";
import globals from "globals";
export default defineConfig(
  jsdoc({
    config: "flat/recommended",
    settings: {
      // TODO: Migrate settings manually
    },
  }),

  {
    languageOptions: {
      globals: {
        myCustomGlobal: "readonly",
        jQuery: "readonly",
        $: "readonly",
        test: "test",
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {},
      ecmaVersion: "latest",
      sourceType: "module",
    },
    extends: [js.configs.recommended, js.configs.all],
    rules: {
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
      "no-var": "error",
      "prefer-const": "error",
      "no-shadow": "error",
      "no-use-before-define": ["error", { functions: false, classes: true }],
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
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "error",
      "require-await": "error",
      "no-param-reassign": ["error", { props: false }],
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
      "no-constructor-return": ["error"],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-unused-vars": [
        "error",
        {
          caughtErrors: "all",
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-useless-computed-key": ["error", { enforceForClassMembers: false }],
      camelcase: [
        "error",
        {
          properties: "always",
          ignoreDestructuring: false,
          ignoreImports: false,
          ignoreGlobals: false,
          allow: '["^UNSAFE_", "^DEPRECATED_", "api_key", "user_id"]',
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lodash",
              message:
                "Please use lodash-es for better tree-shaking.",
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
    },
    files: ["*.test.js", "*.spec.js", "**/__tests__/**/*.js"],
  },
  {
    languageOptions: {
      globals: { ...globals.jest, ...globals.mocha },
      parserOptions: {},
    },
    rules: {
      "no-console": "off",
      "max-len": "off",
    },
    files: ["*.test.js", "*.spec.js", "**/__tests__/**/*.js"],
  },
  {
    languageOptions: { globals: { ...globals.node }, parserOptions: {} },
    rules: {
      "no-console": "off",
    },
    files: ["*.config.js", "webpack.config.js", "vite.config.js"],
  },
  {
    languageOptions: { globals: {}, parserOptions: {} },
    rules: {
      "no-console": "off",
      "no-process-exit": "off",
    },
    files: ["scripts/**/*.js"],
  }
);
