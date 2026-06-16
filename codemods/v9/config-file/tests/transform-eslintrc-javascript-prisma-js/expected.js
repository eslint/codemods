import { fileURLToPath } from "url";
import typescriptParser from "@typescript-eslint/parser";
import TypescriptEslint from "@typescript-eslint/eslint-plugin";
import Jest from "eslint-plugin-jest";
import SimpleImportSort from "eslint-plugin-simple-import-sort";
import Import from "eslint-plugin-import";
import LocalRules from "eslint-plugin-local-rules";
import globals from "globals";
import path from "path";
import { defineConfig, globalIgnores } from "@eslint/config-helpers";
import { FlatCompat } from "@eslint/eslintrc";
import js from '@eslint/js';
import { fixupPluginRules, fixupConfigRules } from "@eslint/compat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

  const compatWithRecommended = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
  });
export default defineConfig([
  globalIgnores(["tmp"]),
  {
    extends: fixupConfigRules(compatWithRecommended.extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@typescript-eslint/recommended-requiring-type-checking",
      "plugin:prettier/recommended",
      "plugin:jest/recommended"
    )),
    plugins: {
      "@typescript-eslint": fixupPluginRules(TypescriptEslint),
      jest: fixupPluginRules(Jest),
      "simple-import-sort": fixupPluginRules(SimpleImportSort),
      import: fixupPluginRules(Import),
      "local-rules": fixupPluginRules(LocalRules)
    },
    languageOptions: {
      globals: {
        custom: true,
        ...globals.node,
        ...globals.es6
      },
      sourceType: "module",
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020
      }
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "warn"
    },
    rules: {
      "prettier/prettier": "warn",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": [
			"error",
			{
				// don't complain if we are omitting properties using spread operator, i.e. const { ignored, ...rest } = someObject
				ignoreRestSiblings: true,
				// for functions, allow to have unused arguments if they start with _. We need to do this from time to time to test type inference within the tests
				argsIgnorePattern: "^_",
			},
		],
      "eslint-comments/no-unlimited-disable": "off",
      "eslint-comments/disable-enable-pair": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "jest/expect-expect": "off",
      "no-empty": "off",
      "no-restricted-properties": [
			"error",
			{
				property: "substr",
				message: "Deprecated: Use .slice() instead of .substr().",
			},
		],
      "jest/valid-title": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "jest/no-conditional-expect": "off",
      "jest/no-export": "off",
      "jest/no-standalone-expect": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "no-constant-binary-expression": 'off',
      "no-empty-static-block": 'off',
      "no-new-native-nonconstructor": 'off',
      "no-unused-private-class-members": 'off'
    },
  },
  {
    files: ["./packages/client/src/runtime/core/types/exported/*.ts"],
    ignores: ["index.ts"],
    languageOptions: {
      parser: typescriptParser
    },
    rules: {
      "local-rules/all-types-are-exported": "error",
      "local-rules/imports-from-same-directory": "error"
    },
  },
  {
    files: ["./packages/client/src/runtime/core/types/exported/index.ts"],
    languageOptions: {
      parser: typescriptParser
    },
    rules: {
      "local-rules/valid-exported-types-index": "error"
    },
  }
]);
