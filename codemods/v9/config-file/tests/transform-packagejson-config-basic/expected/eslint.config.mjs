import globals from "globals";
import { defineConfig } from "@eslint/config-helpers";

export default defineConfig([
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {}
    },
    rules: {
      "no-console": "warn"
    },
  }
]);
