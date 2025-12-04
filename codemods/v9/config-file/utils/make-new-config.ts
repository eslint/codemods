export type SectorData = {
  rules: Record<string, string>;
  extends: string[];
  languageOptions: Record<string, any>;
  files: string;
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
    parts.push("  {");

    if (sector.files) {
      parts.push(`    files: ${sector.files},`);
    }

    if (Object.keys(sector.languageOptions).length > 0) {
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

    if (sector.extends.length) {
      parts.push(`    extends: [${sector.extends.join(", ")}],`);
    }

    if (Object.keys(sector.rules).length > 0) {
      parts.push("    rules: {");
      const rulesEntries = Object.entries(sector.rules);
      rulesEntries.forEach(([key, value], index) => {
        const comma = index < rulesEntries.length - 1 ? "," : "";
        parts.push(`      ${key}: ${value}${comma}`);
      });
      parts.push("    },");
    }

    const comma = sectorIndex < sectors.length - 1 ? "," : "";
    parts.push(`  }${comma}`);
  });

  parts.push("]);");
  parts.push("");

  return parts.join("\n");
};

export default makeNewConfig;
