import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "@eslint/config-helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname
      }
    },
  }
]);
