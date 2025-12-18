import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "@eslint/config-helpers";

const cleanGlobals = (globalsObj) => {
  return Object.fromEntries(Object.entries(globalsObj).map(([key, value]) => [key.trim(), value]));
};

export default defineConfig([
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        myCustomGlobal: "readonly",
        jQuery: "readonly",
        ...cleanGlobals(globals.browser),
        ...cleanGlobals(globals.es2021),
        ...cleanGlobals(globals.node),
      },
      parserOptions: {
        ecmaVersion: "latest",
      },
      sourceType: "module",
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-unused-vars": ["error", { caughtErrors: '"all"', vars: '"all"', args: '"after-used"' }],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: ["error", { properties: '"always"', ignoreDestructuring: false }],
    },
  },
  {
    files: ["*.test.js", "*.spec.js"],
    languageOptions: {
      globals: {
        ...cleanGlobals(globals.jest),
      },
      parserOptions: {},
    },
    rules: {
      "no-console": "off",
    },
  },
]);
