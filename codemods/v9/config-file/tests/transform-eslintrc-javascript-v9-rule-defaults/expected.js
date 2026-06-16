import { defineConfig } from "@eslint/config-helpers";

export default defineConfig([
  {
    rules: {
      "no-implicit-coercion": ["error", { allow: ["-", "- -"] }],
      "no-inner-declarations": ["warn", "both", { blockScopedFunctions: "disallow" }],
      "no-console": "error",
      "no-unused-vars": ["error", {"caughtErrors":"\"all\"","varsIgnorePattern":"\"^_\"","caughtErrorsIgnorePattern":"\"^_\""}]
    },
  }
]);
