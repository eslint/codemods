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

    // If this is a top-level config (no files), spread extends at array level
    if (!hasFiles && hasExtends && !hasLanguageOptions && !hasRules && !hasPlugins) {
      sector.extends.forEach((ext) => {
        // Check if this is a TODO comment
        if (ext.includes("TODO")) {
          parts.push(`  ${ext}`);
        } else {
          parts.push(`  ${ext},`);
        }
      });
    } else if (hasFiles || hasLanguageOptions || hasRules || hasExtends || hasPlugins) {
      // This is an override or has additional properties
      parts.push("  {");

      if (sector.files) {
        parts.push(`    files: ${sector.files},`);
      }

      // In overrides (or when mixing with other properties), spread extends inside the object
      if (hasExtends) {
        sector.extends.forEach((ext) => {
          // Check if this is a TODO comment
          if (ext.includes("TODO")) {
            parts.push(`    ${ext}`);
          } else {
            parts.push(`    ...${ext},`);
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
        if (langOpts.ecmaVersion !== undefined || langOpts.ecmaFeatures !== undefined) {
          if (!langOpts.parserOptions) {
            langOpts.parserOptions = {};
          }
          if (langOpts.ecmaVersion !== undefined) {
            langOpts.parserOptions.ecmaVersion = langOpts.ecmaVersion;
            delete langOpts.ecmaVersion;
          }
          if (langOpts.ecmaFeatures !== undefined) {
            langOpts.parserOptions.ecmaFeatures = langOpts.ecmaFeatures;
            delete langOpts.ecmaFeatures;
          }
        }
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

      const comma = isLastSector ? "" : ",";
      parts.push(`  }${comma}`);
    }
  });

  parts.push("]);");
  parts.push("");

  return parts.join("\n");
};

export default makeNewConfig;
