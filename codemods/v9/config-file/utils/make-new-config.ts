import { getStepOutput } from "codemod:workflow";
import makePluginImport from "./make-plugin-import.ts";

export type SectorData = {
  rules: Record<string, string>;
  extends: string[]; // Preserved extends exactly as they were (as strings)
  languageOptions: Record<string, unknown>;
  files: string;
  plugins?: Array<{ key: string; identifier: string }>;
  requireJsdoc: {
    exists: boolean;
    settings: Record<string, string>;
  };
  extendsTodoComments?: string[]; // TODO comments for extends
};

const formatValue = (value: unknown, indent: number): string => {
  const indentStr = "  ".repeat(indent);
  const nextIndentStr = "  ".repeat(indent + 1);

  if (typeof value === "string") {
    if (value.startsWith("...")) {
      return value;
    }
    return `${value}`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${nextIndentStr}${formatValue(item, indent + 1)}`);
    return `[\n${items.join(",\n")}\n${indentStr}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const props = entries.map(([key, val]) => {
      if (key.startsWith("...")) {
        return `${nextIndentStr}${key}`;
      }
      const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
      return `${nextIndentStr}${formattedKey}: ${formatValue(val, indent + 1)}`;
    });
    return `{\n${props.join(",\n")}\n${indentStr}}`;
  }

  return String(value);
};

const makeNewConfig = (sectors: SectorData[], imports: string[], directory: string): string => {
  let requireJsdocSettings = sectors.find((sector) => sector.requireJsdoc.exists)?.requireJsdoc
    .settings;

  const parts: string[] = [];

  const ignoreFiles = JSON.parse(
    getStepOutput("scan-ignore-files", `ignoreFiles-${directory}`) || "[]"
  ) as unknown as string[];

  if (ignoreFiles.length) {
    imports.push(`import { defineConfig, globalIgnores } from "@eslint/config-helpers";`);
  } else {
    imports.push(`import { defineConfig } from "@eslint/config-helpers";`);
  }

  // Check if we need __dirname (used in tsconfigRootDir or other parserOptions)
  // In ES modules (.mjs), __dirname is not available, so we need to define it
  let needsDirname = sectors.some((sector) => {
    const langOpts = sector.languageOptions;
    if (!langOpts) return false;

    // Check tsconfigRootDir in languageOptions (will be moved to parserOptions)
    if (typeof langOpts.tsconfigRootDir === "string" && langOpts.tsconfigRootDir === "__dirname")
      return true;

    // Check parserOptions.tsconfigRootDir
    if (
      langOpts.parserOptions &&
      typeof langOpts.parserOptions === "object" &&
      langOpts.parserOptions !== null &&
      "tsconfigRootDir" in langOpts.parserOptions &&
      typeof (langOpts.parserOptions as Record<string, unknown>).tsconfigRootDir === "string" &&
      (langOpts.parserOptions as Record<string, unknown>).tsconfigRootDir === "__dirname"
    )
      return true;

    // Check if any value in languageOptions contains __dirname
    const checkForDirname = (obj: Record<string, any>): boolean => {
      for (const value of Object.values(obj)) {
        if (value === "__dirname") return true;
        if (typeof value === "string" && value.includes("__dirname")) return true;
        if (typeof value === "object" && value !== null) {
          if (checkForDirname(value)) return true;
        }
      }
      return false;
    };

    return checkForDirname(langOpts);
  });

  if (sectors.filter((sector) => sector.extends.length).length) {
    imports.push(`import { FlatCompat } from "@eslint/eslintrc";`);
    if (
      sectors.filter((sector) => sector.extends.includes("eslint:recommended")).length ||
      sectors.filter((sector) => sector.extends.includes("eslint:all")).length
    ) {
      imports.push(`import js from '@eslint/js';`);
    }
    needsDirname = true;
  }

  // Check if we need compatibility utilities
  const hasPlugins = sectors.some((sector) => sector.plugins && sector.plugins.length > 0);
  const hasExtends = sectors.some((sector) => sector.extends && sector.extends.length > 0);

  if (hasPlugins || hasExtends) {
    const compatImports: string[] = [];
    if (hasPlugins) compatImports.push("fixupPluginRules");
    if (hasExtends) compatImports.push("fixupConfigRules");
    imports.push(`import { ${compatImports.join(", ")} } from "@eslint/compat";`);
  }

  if (needsDirname) {
    // Add imports for url and path modules (at the beginning)
    if (!imports.some((imp) => imp.includes('from "url"'))) {
      imports.unshift('import { fileURLToPath } from "url";');
    }
    if (!imports.some((imp) => imp.includes('from "path"'))) {
      imports.unshift('import path from "path";');
    }
  }

  parts.push(imports.join("\n"));
  parts.push("");

  // Add __dirname definition if needed (before any other code)
  if (needsDirname) {
    parts.push("const __filename = fileURLToPath(import.meta.url);");
    parts.push("const __dirname = path.dirname(__filename);");
    parts.push("");
  }

  if (sectors.filter((sector) => sector.extends.length).length) {
    let compat = false;
    if (
      sectors.filter((sector) => sector.extends.includes("eslint:recommended")).length &&
      sectors.filter((sector) => sector.extends.includes("eslint:all")).length
    ) {
      parts.push("  const compatWithRecommendedAndAll = new FlatCompat({");
      parts.push("    baseDirectory: __dirname,");
      parts.push("    recommendedConfig: js.configs.recommended,");
      parts.push("    allConfig: js.configs.all,");
      parts.push("  });");
      compat = true;
    } else if (sectors.filter((sector) => sector.extends.includes("eslint:recommended")).length) {
      parts.push("  const compatWithRecommended = new FlatCompat({");
      parts.push("    baseDirectory: __dirname,");
      parts.push("    recommendedConfig: js.configs.recommended,");
      parts.push("  });");
      compat = true;
    } else if (sectors.filter((sector) => sector.extends.includes("eslint:all")).length) {
      parts.push("  const compatWithAll =  new FlatCompat({");
      parts.push("    baseDirectory: __dirname,");
      parts.push("    allConfig: js.configs.all,");
      parts.push("  });");
      compat = true;
    }
    if (
      (compat && sectors.filter((sector) => sector.extends.length).length > 1) ||
      (!compat && sectors.filter((sector) => sector.extends.length).length > 0)
    ) {
      parts.push("  const compat = new FlatCompat({");
      parts.push("    baseDirectory: __dirname,");
      parts.push("  });");
      compat = true;
    }
  }

  parts.push("export default defineConfig([");

  if (ignoreFiles.length) {
    if (ignoreFiles.length === 1) {
      parts.push(`  globalIgnores(["${ignoreFiles[0]}"]),`);
    } else {
      parts.push("  globalIgnores([");
      ignoreFiles.forEach((file, index) => {
        const comma = index < ignoreFiles.length - 1 ? "," : "";
        parts.push(`    "${file}"${comma}`);
      });
      parts.push("  ]),");
    }
  }

  if (requireJsdocSettings) {
    parts.push("  jsdoc({");
    parts.push("    config: 'flat/recommended',");
    parts.push("    settings: {");
    parts.push("      // TODO: Migrate settings manually");
    const settingsEntries = Object.entries(requireJsdocSettings);
    settingsEntries.forEach(([key, value], index) => {
      const comma = index < settingsEntries.length - 1 ? "," : "";
      parts.push(`      ${key}: ${value}${comma}`);
    });
    parts.push("    },");
    parts.push("  }),");
  }

  sectors.forEach((sector, sectorIndex) => {
    const isLastSector = sectorIndex === sectors.length - 1;

    // Preserved extends - all extends are kept exactly as they were (as strings)
    const preservedExtends = sector.extends || [];
    const todoComments = sector.extendsTodoComments || [];

    // Check if we have any content for the sector object
    const hasFiles = !!sector.files;
    const hasLanguageOptions = Object.keys(sector.languageOptions).length > 0;
    const hasRules = Object.keys(sector.rules).length > 0;
    const hasPlugins = sector.plugins && sector.plugins.length > 0;
    const hasExtends = preservedExtends.length > 0;

    // Create an object if we have any properties (files, rules, plugins, languageOptions, extends, TODO comments)
    if (
      hasFiles ||
      hasLanguageOptions ||
      hasRules ||
      hasPlugins ||
      hasExtends ||
      todoComments.length > 0
    ) {
      parts.push("  {");

      if (sector.files) {
        parts.push(`    files: ${sector.files},`);
      }

      // Preserved extends - keep in extends property exactly as they were
      // Note: In flat config, extends is not supported, but we preserve them for reference
      if (hasExtends) {
        let haveEslintRecommended = preservedExtends.includes("eslint:recommended");
        let haveEslintAll = preservedExtends.includes("eslint:all");
        const compatName =
          haveEslintRecommended && haveEslintAll
            ? "compatWithRecommendedAndAll"
            : haveEslintRecommended
              ? "compatWithRecommended"
              : haveEslintAll
                ? "compatWithAll"
                : "compat";
        parts.push(`    extends: fixupConfigRules(${compatName}.extends(`);
        preservedExtends
          .filter((extend) => !["eslint:recommended", "eslint:all"].includes(extend))
          .forEach((ext, index) => {
            const comma = index < preservedExtends.length - 1 ? "," : "";
            // Preserve the extend value exactly as it was (with quotes if it was a string)
            parts.push(`      "${ext}"${comma}`);
          });
        parts.push("    )),");
      }
      // TODO comments should be added inside the object
      // Also handle processor property if present in todoComments
      if (todoComments.length > 0) {
        todoComments.forEach((comment: string) => {
          // Check if this is a processor property (not a comment)
          if (comment.includes("processor:") && !comment.trim().startsWith("//")) {
            parts.push(`    ${comment}`);
          } else {
            parts.push(`    ${comment}`);
          }
        });
      }

      if (hasPlugins) {
        parts.push("    plugins: {");
        sector.plugins?.forEach((plugin, index) => {
          const comma = index < (sector.plugins?.length ?? 0) - 1 ? "," : "";
          // Use the original plugin name as the key and wrap the imported identifier with fixupPluginRules
          parts.push(`      ${plugin.key}: fixupPluginRules(${plugin.identifier})${comma}`);
        });
        parts.push("    },");
      }

      if (hasLanguageOptions) {
        const langOpts = { ...sector.languageOptions };

        // Clean globals if they exist (remove whitespace from keys)
        if (langOpts.globals && typeof langOpts.globals === "object") {
          const cleanedGlobals: Record<string, any> = {};
          Object.entries(langOpts.globals).forEach(([key, value]) => {
            // Check if this is a spread operator (starts with ...)
            if (key.startsWith("...")) {
              cleanedGlobals[key] = value;
            } else {
              // Regular globals - just trim the key
              cleanedGlobals[key.trim()] = value;
            }
          });
          langOpts.globals = cleanedGlobals;
        }

        // Properties that must be moved into parserOptions in ESLint v9 flat config
        // These are parser-specific options, not language options
        const parserOptionProps = [
          // ECMAScript parser options
          "ecmaVersion",
          "ecmaFeatures",
          // Babel parser options
          "requireConfigFile",
          "babelOptions",
          // TypeScript parser options
          "project",
          "createDefaultProgram",
          "tsconfigRootDir",
          "extraFileExtensions",
          "program",
        ];

        // Move properties that should be in parserOptions
        const propsToMove = parserOptionProps.filter((prop) => langOpts[prop] !== undefined);
        if (propsToMove.length > 0) {
          if (!langOpts.parserOptions) {
            langOpts.parserOptions = {};
          }
          const parserOptions = langOpts.parserOptions as Record<string, unknown>;
          propsToMove.forEach((prop) => {
            parserOptions[prop] = langOpts[prop];
            delete langOpts[prop];
          });
        }
        // All other properties remain in languageOptions as-is
        const formattedLangOpts = formatValue(langOpts, 2);
        parts.push(`    languageOptions: ${formattedLangOpts},`);
      }

      if (hasRules) {
        parts.push("    rules: {");
        const rulesEntries = Object.entries(sector.rules);
        rulesEntries.forEach(([key, value], index) => {
          const comma = index < rulesEntries.length - 1 ? "," : "";
          // Handle spread operators in rules (keys starting with ...)
          if (key.startsWith("...")) {
            parts.push(`      ${key}${comma}`);
          } else {
            parts.push(`      ${key}: ${value}${comma}`);
          }
        });
        parts.push("    },");
      }

      // Add comma if there are more sectors
      const comma = isLastSector ? "" : ",";
      parts.push(`  }${comma}`);
    }
  });

  parts.push("]);");
  parts.push("");

  const importNames = imports.map((importStatement) => {
    const doubleQuoteMatch = importStatement.match(/from\s+"([^"]+)"/);
    const singleQuoteMatch = importStatement.match(/from\s+'([^']+)'/);
    const packageName = doubleQuoteMatch?.[1] || singleQuoteMatch?.[1];
    return packageName || importStatement;
  });

  for (let extend of sectors.map((sector) => sector.extends).flat()) {
    if (extend.startsWith("eslint:")) {
      importNames.push(`@eslint/js`);
    } else if (extend.startsWith("plugin:")) {
      extend = extend.replace("plugin:", "");
      let splitted = extend.split("/");
      let packageDate;
      if (splitted.length > 1) {
        splitted.pop();
        packageDate = makePluginImport(splitted.join("/"));
      } else {
        packageDate = makePluginImport(splitted[0] ?? "");
      }
      importNames.push(packageDate.packageName);
    } else if (extend.startsWith("config:")) {
      extend = extend.replace("config:", "");
      importNames.push(`eslint-config-${extend.split(":")[1]}`);
    } else if (extend.startsWith("@")) {
      let splitted = extend.split("/");
      if (splitted.length > 2) {
        splitted.pop();
      } else if (splitted.length === 2) {
        importNames.push(splitted.join("/"));
      } else {
        importNames.push(extend);
      }
    }
  }

  if (importNames.length > 0) {
    const uniqueImportNames = [
      ...new Set(importNames.filter((pkg) => pkg && !pkg.startsWith("import"))),
    ];

    if (uniqueImportNames.length > 0) {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Package Installation Required                                 ║
╚════════════════════════════════════════════════════════════════╝

You will need to install the following packages:

${uniqueImportNames.map((pkg) => `  • ${pkg}`).join("\n")}

Installation command:
  npm install ${uniqueImportNames.map((pkg) => `${pkg}`).join(" ")} -D

\x1b[33mNote: Please verify that all packages are not deprecated and still supported for ESLint v9.\x1b[0m

`);
    }
  }

  return parts.join("\n");
};

export default makeNewConfig;
