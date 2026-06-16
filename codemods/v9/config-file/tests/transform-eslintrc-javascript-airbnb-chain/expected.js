import path from "path";
import { fileURLToPath } from "url";
import globals from "globals";
import airbnbBase from "eslint-config-airbnb-base";
import { defineConfig, globalIgnores } from "@eslint/config-helpers";
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
  globalIgnores(['dist']),
  {
    extends: fixupConfigRules(compatWithRecommended.extends(
      "eslint:recommended",
      "airbnb-base",
      "plugin:prettier/recommended"
    )),
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-param-reassign": [
        'error',
        {
            props: true,
            ignorePropertyModificationsFor: require(airbnbBase.extends[0]).rules[
    'no-param-reassign'
][1].ignorePropertyModificationsFor.concat(
    'err',
    'x',
),
        },
    ],
      "no-constant-binary-expression": 'off',
      "no-empty-static-block": 'off',
      "no-new-native-nonconstructor": 'off',
      "no-unused-private-class-members": 'off'
    },
  }
]);
