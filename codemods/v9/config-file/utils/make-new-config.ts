export type SectorData = {
  rules: Record<string, string>;
  extends: string[];
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

  parts.push(imports.join("\n"));
  parts.push("");

  parts.push("export default defineConfig([");

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

    // Check if we have any content for the sector object
    const hasFiles = !!sector.files;
    const hasLanguageOptions = Object.keys(sector.languageOptions).length > 0;
    const hasRules = Object.keys(sector.rules).length > 0;
    const hasExtends = sector.extends.length > 0;
    const hasPlugins = sector.plugins && Object.keys(sector.plugins).length > 0;

    // Separate config references from other extends
    // Config references are patterns like: js.configs.recommended, ember.configs["flat/recommended"]
    const configRefPattern =
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\.configs(\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[["']flat\/[^"']+["']\])$/;
    const configRefs: string[] = [];
    const otherExtends: string[] = [];

    if (hasExtends) {
      sector.extends.forEach((ext) => {
        if (configRefPattern.test(ext)) {
          configRefs.push(ext);
        } else {
          otherExtends.push(ext);
        }
      });
    }

    // Config references should always be added as separate array elements
    configRefs.forEach((ext, index) => {
      // Add comma unless this is the last config ref AND there are no more items to add
      const isLastConfigRef = index === configRefs.length - 1;
      const hasMoreItems =
        !isLastSector ||
        hasFiles ||
        hasLanguageOptions ||
        hasRules ||
        hasPlugins ||
        otherExtends.length > 0;
      const comma = isLastConfigRef && !hasMoreItems ? "" : ",";
      parts.push(`  ${ext}${comma}`);
    });

    // If there are other properties (files, languageOptions, rules, plugins) or non-config extends,
    // create an object for them
    if (hasFiles || hasLanguageOptions || hasRules || hasPlugins || otherExtends.length > 0) {
      parts.push("  {");

      if (sector.files) {
        parts.push(`    files: ${sector.files},`);
      }

      // Non-config extends (like TODO comments) should be handled separately
      if (otherExtends.length > 0) {
        otherExtends.forEach((ext) => {
          // Check if this is a TODO comment
          if (ext.includes("TODO")) {
            parts.push(`    ${ext}`);
          } else {
            parts.push(`    ...${ext},`);
            // For other non-config extends, add as TODO comment instead of spreading
            parts.push(
              `    /* TODO: Migrate "${ext}" manually - this extend needs to be converted to flat config format */`
            );
          }
        });
      }

      if (hasPlugins && sector.plugins) {
        parts.push("    plugins: {");
        const pluginsEntries = Object.entries(sector.plugins);
        pluginsEntries.forEach(([key, value], index) => {
          const comma = index < pluginsEntries.length - 1 ? "," : "";
          parts.push(`      ${key}: ${value}${comma}`);
        });
        parts.push("    },");
      }

      if (hasLanguageOptions) {
        const langOpts = { ...sector.languageOptions };
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
