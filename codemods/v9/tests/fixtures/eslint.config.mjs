import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
export default defineConfig([
  {
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        myCustomGlobal: '"readonly"',
        jQuery: '"readonly"',
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: '"latest"',
        sourceType: '"module"',
      },
    },
    rules: {
      "no-console": ["warn", { allow: {} }, "warn", "error"],
      allow: ["warn", "error"],
      vars: "all",
      args: "after-used",
      caughtErrors: "all",
      allowInParentheses: false,
      properties: "always",
      ignoreDestructuring: false,
      enforceForClassMembers: true,
      "no-unused-vars": [
        "error",
        { vars: "all", args: "after-used", caughtErrors: "all" },
      ],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: [
        "error",
        { properties: "always", ignoreDestructuring: false },
      ],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.jest,
      },
      parserOptions: {},
    },
    rules: {
      "no-console": "off",
    },
    files: ["*.test.js", "*.spec.js"],
  },
]);
