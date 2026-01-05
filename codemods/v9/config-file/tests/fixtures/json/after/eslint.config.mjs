import path from "path";
import { fileURLToPath } from "url";
import globals from "globals";
import { defineConfig } from "@eslint/config-helpers";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compatWithRecommended = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});
export default defineConfig([
  {
    extends: compatWithRecommended.extends(),
    languageOptions: {
      globals: {
        myCustomGlobal: "readonly",
        jQuery: "readonly",
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
      },
      sourceType: "module",
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-sequences": ["error", { allowInParentheses: false }],
      "no-unused-vars": [
        "error",
        { caughtErrors: '"all"', vars: '"all"', args: '"after-used"' },
      ],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: [
        "error",
        { properties: '"always"', ignoreDestructuring: false },
      ],
    },
  },
  {
    files: ["*.test.js", "*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
      parserOptions: {},
    },
    rules: {
      "no-console": "off",
    },
  },
]);
