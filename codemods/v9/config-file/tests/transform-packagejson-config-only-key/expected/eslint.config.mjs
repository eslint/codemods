import { defineConfig } from "@eslint/config-helpers";

export default defineConfig([
  {
    languageOptions: {
      globals: {},
      parserOptions: {}
    },
    rules: {
      "no-console": "warn"
    },
  }
]);
