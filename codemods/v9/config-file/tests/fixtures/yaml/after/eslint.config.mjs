import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        myCustomGlobal: readonly,
        jQuery: readonly,
        ...globals.browser,
        ...globals.es2021,
        ...globals.node
      },
      parserOptions: {
        ecmaVersion: "latest"
      },
      sourceType: "module"
    },
    rules: {
      "no-console": ["warn",{"allow":["warn","error"]}],
      "no-sequences": ["error", {"allowInParentheses": false}],
      "no-unused-vars": ["error", {"caughtErrors":"all","vars":"all","args":"after-used"}],
      "no-useless-computed-key": ["error", {enforceForClassMembers: true}],
      "camelcase": ["error", {"properties":"always","ignoreDestructuring":false}]
    },
  },
  {
    files: ["*.test.js","*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.jest
      },
      parserOptions: {}
    },
    rules: {
      "no-console": "off"
    },
  }
]);
