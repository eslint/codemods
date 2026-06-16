import { defineConfig } from "@eslint/config-helpers";

export default defineConfig([
  {
    rules: {
      "no-invalid-regexp": ["error", { allowConstructorFlags: ["a", "A", "B", "b", "x", "X"] }],
      "no-console": "error"
    },
  }
]);
