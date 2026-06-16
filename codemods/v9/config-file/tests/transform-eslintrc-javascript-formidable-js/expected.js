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
  globalIgnores(["dist"]),
  {
    extends: fixupConfigRules(compatWithRecommended.extends(
      "eslint:recommended",
      "airbnb-base",
      "plugin:prettier/recommended"
    )),
    languageOptions: {
      globals: {
        ...globals.es6,
        ...globals.es2020,
        ...globals.jest,
        ...globals.node,
        ...globals.commonjs
      }
    },
    rules: {
      strict: 'off',
      "func-names": ['error', 'always'],
      "arrow-parens": ['error', 'always', { requireForBlockBody: true }],
      "prefer-arrow-callback": [
        'error',
        { allowNamedFunctions: true, allowUnboundThis: true },
    ],
      "max-params": ['error', { max: 3 }],
      "max-statements": ['error', { max: 20 }],
      "max-statements-per-line": ['error', { max: 1 }],
      "max-nested-callbacks": ['error', { max: 4 }],
      "max-depth": ['error', { max: 4 }],
      "arrow-body-style": [
        'error',
        'as-needed',
        { requireReturnForObjectLiteral: false },
    ],
      "no-use-before-define": [
        'error',
        {
            functions: false,
            classes: true,
            variables: true,
        },
    ],
      "no-param-reassign": [
        'error',
        {
            props: true,
            ignorePropertyModificationsFor: require(airbnbBase.extends[0]).rules[
    'no-param-reassign'
][1].ignorePropertyModificationsFor.concat(
    'err',
    'x',
    '_',
    'opts',
    'options',
    'settings',
    'config',
    'cfg',
),
        },
    ],
      "no-unused-vars": [
        'error',
        {
            ignoreRestSiblings: true, // airbnb's default
            vars: 'all', // airbnb's default
            varsIgnorePattern: '^(?:$$|xx|_|__|[iI]gnor(?:e|ing|ed))',
            args: 'after-used', // airbnb's default
            argsIgnorePattern: '^(?:$$|xx|_|__|[iI]gnor(?:e|ing|ed))',

            // catch blocks are handled by Unicorns
            caughtErrors: 'none',
            // caughtErrorsIgnorePattern: '^(?:$$|xx|_|__|[iI]gnor(?:e|ing|ed))',
        },
    ],
      "import/namespace": ['error', { allowComputed: true }],
      "import/no-absolute-path": 'error',
      "import/no-webpack-loader-syntax": 'error',
      "import/no-self-import": 'error',
      "import/no-amd": 'error',
      "import/no-duplicates": 'error',
      "import/no-extraneous-dependencies": 'off',
      "import/no-mutable-exports": 'error',
      "import/no-named-as-default-member": 'error',
      "import/no-named-as-default": 'error',
      "import/order": 'error',
      "import/no-unassigned-import": [
        'error',
        { allow: ['@babel/polyfill', '@babel/register'] },
    ],
      "import/prefer-default-export": 'off',
      "import/extensions": 'off',
      "import/exports-last": 'off',
      "import/no-unused-modules": 'off',
      "import/no-useless-path-segments": ['error', { noUselessIndex: false }],
      "no-constant-binary-expression": 'off',
      "no-empty-static-block": 'off',
      "no-new-native-nonconstructor": 'off',
      "no-unused-private-class-members": 'off'
    },
  }
]);
