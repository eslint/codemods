import { getStepOutput } from "codemod:workflow";

export type SectorData = {
  rules: Record<string, string>;
  extends: string[]; // Direct config objects to spread in array (e.g., js.configs.recommended)
  extendsUnknown?: string[]; // Unknown extends that need TODO comments and should stay in extends property
  extendsTodoComments?: string[]; // TODO comments for extends that couldn't be migrated
  languageOptions: Record<string, any>;
  files: string;
  plugins?: Record<string, string>;
  requireJsdoc: {
    exists: boolean;
    settings: Record<string, string>;
  };
};

const formatValue = (value: any, indent: number): string => {
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

const makeNewConfig = (sectors: SectorData[], imports: string[]): string => {
  let requireJsdocSettings = sectors.find((sector) => sector.requireJsdoc.exists)?.requireJsdoc
    .settings;

  const parts: string[] = [];

  const ignoreFiles = JSON.parse(
    getStepOutput("scan-ignore-files", "ignoreFiles") || "[]"
  ) as unknown as string[];

  if (ignoreFiles.length) {
    imports.push("import { defineConfig, globalIgnores } from '@eslint/config-helpers'");
  } else {
    imports.push("import { defineConfig } from '@eslint/config-helpers'");
  }

  // Check if we need cleanGlobals helper (if any sector uses globals)
  const needsCleanGlobals = sectors.some(
    (sector) =>
      sector.languageOptions.globals && Object.keys(sector.languageOptions.globals).length > 0
  );
  if (needsCleanGlobals && !imports.some((imp) => imp.includes('import globals from "globals"'))) {
    imports.push('import globals from "globals";');
  }

  parts.push(imports.join("\n"));
  parts.push("");

  // Add cleanGlobals helper if needed
  if (needsCleanGlobals) {
    parts.push("const cleanGlobals = (globalsObj) => {");
    parts.push("  return Object.fromEntries(");
    parts.push("    Object.entries(globalsObj).map(([key, value]) => [key.trim(), value])");
    parts.push("  );");
    parts.push("};");
    parts.push("");
  }

  parts.push("export default defineConfig([");

  if (ignoreFiles.length) {
    parts.push(`  globalIgnores([${ignoreFiles.map((file) => `"${file}"`).join(", ")}]),`);
  }

  if (requireJsdocSettings) {
    parts.push("  jsdoc({");
    parts.push("    config: 'flat/recommended',");
    parts.push("    settings: {");
    parts.push("      // TODO: Migrate settings manually");
    Object.entries(requireJsdocSettings).forEach(([key, value], index, arr) => {
      const comma = index < arr.length - 1 ? "," : "";
      parts.push(`      ${key}: ${value}${comma}`);
    });
    parts.push("    },");
    parts.push("  }),");
  }

  sectors.forEach((sector, sectorIndex) => {
    const isLastSector = sectorIndex === sectors.length - 1;

    // Separate known configs (direct spreading) from unknown configs (keep in extends with TODO)
    const directConfigs = sector.extends || []; // Known configs to spread directly
    const unknownExtends = sector.extendsUnknown || []; // Unknown configs to keep in extends with TODO
    const todoComments = sector.extendsTodoComments || [];

    // Spread direct configs first (these are actual config objects, not strings)
    directConfigs.forEach((config, index) => {
      const isLastDirectConfig = index === directConfigs.length - 1;
      const hasMoreItems =
        !isLastSector ||
        !!sector.files ||
        Object.keys(sector.languageOptions).length > 0 ||
        Object.keys(sector.rules).length > 0 ||
        (sector.plugins && Object.keys(sector.plugins).length > 0) ||
        unknownExtends.length > 0 ||
        todoComments.length > 0;
      const comma = isLastDirectConfig && !hasMoreItems ? "" : ",";
      parts.push(`  ${config}${comma}`);
    });

    // Check if we have any content for the sector object
    const hasFiles = !!sector.files;
    const hasLanguageOptions = Object.keys(sector.languageOptions).length > 0;
    const hasRules = Object.keys(sector.rules).length > 0;
    const hasPlugins = sector.plugins && Object.keys(sector.plugins).length > 0;
    const hasUnknownExtends = unknownExtends.length > 0;

    // Create an object if we have any properties (files, rules, plugins, languageOptions, extends, TODO comments)
    if (
      hasFiles ||
      hasLanguageOptions ||
      hasRules ||
      hasPlugins ||
      hasUnknownExtends ||
      todoComments.length > 0
    ) {
      parts.push("  {");

      if (sector.files) {
        parts.push(`    files: ${sector.files},`);
      }

      // Unknown extends - keep in extends property with TODO comment above
      if (hasUnknownExtends) {
        parts.push(
          "    // TODO: The following extends need manual migration - check their flat config support"
        );
        parts.push("    extends: [");
        unknownExtends.forEach((ext, index) => {
          const comma = index < unknownExtends.length - 1 ? "," : "";
          parts.push(`      ${ext}${comma}`);
        });
        parts.push("    ],");
      }

      // TODO comments should be added inside the object
      if (todoComments.length > 0) {
        todoComments.forEach((comment) => {
          parts.push(`    ${comment}`);
        });
      }

      if (hasPlugins && sector.plugins) {
        parts.push("    plugins: {");
        const pluginsEntries = Object.entries(sector.plugins);
        pluginsEntries.forEach(([key, value], index) => {
          const comma = index < pluginsEntries.length - 1 ? "," : "";
          parts.push(`      "${key}": ${value}${comma}`);
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
            if (key.startsWith("...globals.")) {
              // For spread operators like ...globals.browser, wrap with cleanGlobals
              const spreadKey = key.replace("...", "");
              cleanedGlobals[`...cleanGlobals(${spreadKey})`] = value;
            } else if (key.startsWith("...")) {
              // Other spread operators - keep as is but might need cleanGlobals
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
          propsToMove.forEach((prop) => {
            langOpts.parserOptions[prop] = langOpts[prop];
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
          parts.push(`      ${key}: ${value}${comma}`);
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

  return parts.join("\n");
};

export default makeNewConfig;
