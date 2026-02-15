import path from "path";
import { fileURLToPath } from "url";
import globals from "globals";
import Ember from "eslint-plugin-ember";
import Node from "eslint-plugin-node";
import { defineConfig } from "@eslint/config-helpers";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { fixupPluginRules, fixupConfigRules } from "@eslint/compat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compatWithRecommended = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});
const compat = new FlatCompat({
  baseDirectory: __dirname,
});
export default defineConfig([
  {
    extends: fixupConfigRules(compatWithRecommended.extends("plugin:react/recommended")),
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
      "no-unused-vars": ["error", { caughtErrors: '"all"', vars: '"all"', args: '"after-used"' }],
      "no-useless-computed-key": ["error", { enforceForClassMembers: true }],
      camelcase: ["error", { properties: '"always"', ignoreDestructuring: false }],
    },
  },
  {
    extends: fixupConfigRules(compatWithRecommended.extends("plugin:react/recommended")),
    plugins: {
      ember: fixupPluginRules(Ember),
      node: fixupPluginRules(Node),
    },
    languageOptions: {
      globals: {},
      parserOptions: {},
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
