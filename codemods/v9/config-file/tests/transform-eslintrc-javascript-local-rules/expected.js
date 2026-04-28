import path from "path";
import { fileURLToPath } from "url";
import globals from "globals";
import { defineConfig } from "@eslint/config-helpers";
import { FlatCompat } from "@eslint/eslintrc";
import js from '@eslint/js';
import { fixupConfigRules } from "@eslint/compat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

  const compatWithRecommended = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
  });
export default defineConfig([
  {
    extends: fixupConfigRules(compatWithRecommended.extends(
      "eslint:recommended"
    )),
    languageOptions: {
      globals: {
        ...globals.node
      },
      parserOptions: {}
    },
    rules: {
      "no-console": "warn",
      eqeqeq: "error"
    },
  }
]);
