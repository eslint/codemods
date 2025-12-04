import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
export default defineConfig(
  {
    languageOptions: {
      globals: {
        myCustomGlobal: "readonly",
        jQuery: "readonly",
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {},
      ecmaVersion: "latest",
      sourceType: "module",
    },
    extends: [js.configs.recommended],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-unused-vars": [
        "error",
        { caughtErrors: "all", vars: "all", args: "after-used" },
      ],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: [
        "error",
        { properties: "always", ignoreDestructuring: false },
      ],
    },
  },
  {
    languageOptions: { globals: { ...globals.jest }, parserOptions: {} },
    rules: {
      "no-console": "off",
    },
    files: ["*.test.js", "*.spec.js"],
  }
);
