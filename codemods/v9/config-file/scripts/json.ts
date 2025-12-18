import { type SgRoot, parse } from "codemod:ast-grep";
import type JSON from "codemod:ast-grep/langs/json";
import { type SgNode } from "codemod:ast-grep";
import { getStepOutput } from "codemod:workflow";
import makeNewConfig from "../utils/make-new-config.ts";
import type { SectorData } from "../utils/make-new-config.ts";
import path from "path";

async function transform(root: SgRoot<JSON>): Promise<string | null> {
  const rootNode = root.root();
  const source = rootNode.text();
  // For JSON, we look for the root object and objects inside overrides array
  let rulesSectorsRule = rootNode.findAll({
    rule: {
      any: [
        {
          kind: "object",
          has: {
            kind: "pair",
            has: {
              kind: "string",
              regex: '"rules"',
            },
          },
        },
        {
          kind: "object",
          inside: {
            kind: "array",
            inside: {
              kind: "pair",
              has: {
                kind: "string",
                regex: '"overrides"',
              },
            },
          },
        },
      ],
    },
  });

  let imports: string[] = [];

  let sectors: SectorData[] = [];
  let needsPrettierPlugin = false; // Track if we need to add prettier plugin config
  let needsAngularConfigs = false; // Track if we need to add Angular configs
  let angularConfigInfo: {
    pluginImportName: string;
    hasInlineTemplates: boolean;
  } | null = null;

  for (let sector of rulesSectorsRule) {
    let sectorData = {
      rules: {} as Record<string, string>,
      extends: [] as string[], // Known configs to spread directly in array
      extendsUnknown: [] as string[], // Unknown configs to keep in extends property with TODO
      extendsTodoComments: [] as string[], // TODO comments for extends
      languageOptions: {} as Record<string, any>,
      files: String() as string,
      plugins: {} as Record<string, string>,
      requireJsdoc: {
        exists: false,
        settings: {},
      },
    };
    // remove sector overrides
    let overridesRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          regex: '"overrides"',
        },
      },
    });
    if (overridesRule) {
      let overrides = overridesRule?.text();
      let newSectorText = sector.text();
      newSectorText = newSectorText.replace(overrides, "");
      let newSectorRoot = parse("json", newSectorText) as SgRoot<JSON>;
      sector = newSectorRoot.root();
    }

    // start detecting parser
    // In flat config, parser must be an imported object, not a string
    // Map common parser packages to their import names
    const parserImportMap: Record<string, { importName: string; packageName: string }> = {
      "@typescript-eslint/parser": {
        importName: "typescriptParser",
        packageName: "@typescript-eslint/parser",
      },
      "@babel/eslint-parser": { importName: "babelParser", packageName: "@babel/eslint-parser" },
      "babel-eslint": { importName: "babelEslint", packageName: "babel-eslint" },
      "vue-eslint-parser": { importName: "vueParser", packageName: "vue-eslint-parser" },
      espree: { importName: "espree", packageName: "espree" },
      "@angular-eslint/template-parser": {
        importName: "templateParser",
        packageName: "@angular-eslint/template-parser",
      },
      "svelte-eslint-parser": { importName: "svelteParser", packageName: "svelte-eslint-parser" },
      "jsonc-eslint-parser": { importName: "jsoncParser", packageName: "jsonc-eslint-parser" },
      "yaml-eslint-parser": { importName: "yamlParser", packageName: "yaml-eslint-parser" },
      "@graphql-eslint/eslint-plugin": {
        importName: "graphqlParser",
        packageName: "@graphql-eslint/eslint-plugin",
      },
    };

    const parserPairRule = rootNode.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          regex: '"parser"',
        },
      },
    });
    let parser = "";
    if (parserPairRule) {
      // Find the value string (the second string that is not "parser")
      let parserValueRule = parserPairRule.find({
        rule: {
          kind: "string",
          not: {
            regex: '"parser"',
          },
        },
      });
      if (parserValueRule) {
        let parserString = parserValueRule.text();
        // Remove quotes
        if (parserString[0] == '"' && parserString[parserString.length - 1] == '"') {
          parserString = parserString.substring(1, parserString.length - 1);
        }

        const parserInfo = parserImportMap[parserString];
        if (parserInfo) {
          // Add import for the parser
          const parserImport = `import ${parserInfo.importName} from "${parserInfo.packageName}";`;
          if (!imports.includes(parserImport)) {
            imports.push(parserImport);
          }
          parser = parserInfo.importName;
        } else {
          // Unknown parser - generate a reasonable import name
          const importName = parserString
            .replace(/^@/, "")
            .replace(/[/-]([a-z])/g, (_, letter: string) => letter.toUpperCase())
            .replace(/^([a-z])/, (_, letter: string) => letter.toUpperCase())
            .replace(/[^a-zA-Z0-9]/g, "");
          const parserImport = `import ${importName} from "${parserString}";`;
          if (!imports.includes(parserImport)) {
            imports.push(parserImport);
          }
          parser = importName;
        }
      }
    }
    // end detecting parser

    // start detecting rules
    let rulesRule = sector.findAll({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          nthChild: 1,
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              regex: '"rules"',
            },
          },
        },
      },
    });
    for (let rule of rulesRule) {
      let identifer = rule.getMatch("IDENTIFIER")?.text();
      if (!identifer) continue;
      let value = rule.text().trim().replace(`${identifer}:`, "").trim().replace(/,\s*$/, "");
      sectorData.rules[identifer] = value;
    }
    // end detecting rules
    // start detecting extends
    let arrayExtendsRule = sector.find({
      rule: {
        kind: "array",
        inside: {
          kind: "pair",
          has: {
            kind: "string",
            regex: '"extends"',
          },
        },
      },
    });
    if (arrayExtendsRule) {
      let arrayExtendsText = arrayExtendsRule.text();
      let arrayExtends = arrayExtendsText
        .slice(1, arrayExtendsText.length - 1)
        .trim()
        .split(",");
      for (let extend of arrayExtends) {
        if (extend) {
          sectorData.extends.push(extend.trim());
        }
      }
    }
    // end detecting extends

    // start jsDocs section
    let jsDocs = {
      type: "nothing",
      options: {},
    };
    const requireJsdocRule = sector.findAll({
      rule: {
        kind: "pair",
        pattern: "$PAIR",
        has: {
          kind: "string",
          pattern: '"require-jsdoc"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    for (let jsdoc of requireJsdocRule) {
      let identifier = jsdoc.getMatch("IDENTIFIER")?.text();
      if (identifier == '"rules"') {
        let pair = jsdoc?.getMatch("PAIR")?.text().trim().replace('"require-jsdoc":', "").trim();
        if (pair?.[0] == '"' && pair?.[pair.length - 1] == '"') {
          jsDocs.type = pair.substring(1, pair.length - 1);
          continue;
        }
        let jsdocTypeRule = jsdoc.find({
          rule: {
            kind: "string",
            pattern: "$TYPE",
            inside: {
              kind: "array",
            },
          },
        });
        let jsdocOptionsRule = jsdoc.findAll({
          rule: {
            kind: "pair",
            pattern: "$PAIR",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
            inside: {
              kind: "object",
              inside: {
                kind: "pair",
                has: {
                  kind: "string",
                  pattern: "$SETTING_IDENTIFIER",
                },
                inside: {
                  kind: "object",
                  inside: {
                    kind: "array",
                  },
                },
              },
            },
          },
        });
        if (jsdocTypeRule) {
          let jsdocType = jsdocTypeRule.getMatch("TYPE")?.text() || "";
          // Remove quotes from jsdocType
          if (jsdocType[0] == '"' && jsdocType[jsdocType.length - 1] == '"') {
            jsdocType = jsdocType.substring(1, jsdocType.length - 1);
          }
          let jsdocOptions: Record<string, string> = {};
          if (jsdocOptionsRule.length) {
            let optionsIdentifier = jsdocOptionsRule[0]?.getMatch("SETTING_IDENTIFIER")?.text();
            if (optionsIdentifier == '"require"') {
              for (let option of jsdocOptionsRule) {
                let identifier = option.getMatch("IDENTIFIER")?.text();
                if (identifier) {
                  let value = option.text().replace(`${identifier}:`, "");
                  value = value.trim();
                  jsdocOptions[identifier] = value;
                }
              }
            }
          }
          jsDocs = { type: jsdocType, options: jsdocOptions };
        }
      }
    }
    delete sectorData.rules['"require-jsdoc"'];
    delete sectorData.rules['"valid-jsdoc"'];
    if (
      (jsDocs.type != "nothing" && jsDocs.type != "off") ||
      getStepOutput("scan-file-jsdoc", "isJsdoccommentExists") == "true"
    ) {
      sectorData.requireJsdoc.exists = true;
      sectorData.requireJsdoc.settings = jsDocs.options;
      imports.push('import { jsdoc } from "eslint-plugin-jsdoc";');
    }
    // end jsDocs section
    // start no-constructor-return and no-sequences section
    let noConstructorReturn = "";
    let noConstructorReturnRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          pattern: '"no-constructor-return"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noConstructorReturnRule) {
      let isArrayRule = noConstructorReturnRule.findAll({
        rule: {
          kind: "string",
          pattern: "$TYPE",
          inside: {
            kind: "array",
          },
        },
      });
      if (isArrayRule.length) {
        let typeText = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        // Remove quotes
        if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
          noConstructorReturn = typeText.substring(1, typeText.length - 1);
        }
      } else {
        let typeRule = noConstructorReturnRule.findAll({
          rule: {
            kind: "string",
            pattern: "$TYPE",
          },
        });
        typeRule = typeRule.filter((rule) => {
          let text = rule.getMatch("TYPE")?.text() || "";
          return text != '"no-constructor-return"';
        });
        if (typeRule.length) {
          let typeText = typeRule[0]?.getMatch("TYPE")?.text() || "";
          if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
            noConstructorReturn = typeText.substring(1, typeText.length - 1);
          }
        }
      }
    }
    if (noConstructorReturn) {
      delete sectorData.rules['"no-constructor-return"'];
      sectorData.rules['"no-constructor-return"'] = `["${noConstructorReturn}"]`;
    }

    let noSequences = {
      type: "nothing",
      allowInParenthesesExists: false,
      allowInParentheses: false,
    };
    let noSequencesRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          pattern: '"no-sequences"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noSequencesRule) {
      let isArrayRule = noSequencesRule.findAll({
        rule: {
          kind: "string",
          pattern: "$TYPE",
          inside: {
            kind: "array",
            pattern: "$ARRAY",
          },
        },
      });
      if (isArrayRule.length) {
        let array: SgNode<JSON> | undefined;
        let noSequencesRuleTypeObject = isArrayRule.filter((rule) => {
          let noSequencesRuleType = rule.getMatch("TYPE")?.text() || "";
          // Remove quotes
          if (
            noSequencesRuleType[0] == '"' &&
            noSequencesRuleType[noSequencesRuleType.length - 1] == '"'
          ) {
            noSequencesRuleType = noSequencesRuleType.substring(1, noSequencesRuleType.length - 1);
          }
          let arrayRule = rule.getMatch("ARRAY");
          if (arrayRule) {
            array = arrayRule;
          }
          return ["error", "warn"].includes(noSequencesRuleType) ? true : false;
        });
        if (noSequencesRuleTypeObject.length) {
          let noSequencesRuleType = noSequencesRuleTypeObject[0]?.getMatch("TYPE")?.text() || "";
          // Remove quotes
          if (
            noSequencesRuleType[0] == '"' &&
            noSequencesRuleType[noSequencesRuleType.length - 1] == '"'
          ) {
            noSequencesRuleType = noSequencesRuleType.substring(1, noSequencesRuleType.length - 1);
          }
          noSequences.type = noSequencesRuleType;
          let allowInParenthesesOptionRule = array?.find({
            rule: {
              kind: "string",
              regex: '"allowInParentheses"',
              inside: {
                kind: "pair",
                pattern: "$PAIR",
                inside: {
                  kind: "object",
                },
              },
            },
          });
          if (allowInParenthesesOptionRule) {
            let pairNode = allowInParenthesesOptionRule.parent()?.parent();
            let allowInParenthesesOption = pairNode?.text() || "";
            allowInParenthesesOption = allowInParenthesesOption
              .trim()
              .replace('"allowInParentheses":', "")
              .trim();
            noSequences.allowInParentheses = allowInParenthesesOption == "true" ? true : false;
            noSequences.allowInParenthesesExists = true;
          }
        }
      } else {
        let typeRule = noSequencesRule.findAll({
          rule: {
            kind: "string",
            pattern: "$TYPE",
          },
        });
        typeRule = typeRule.filter((rule) => {
          let text = rule.getMatch("TYPE")?.text() || "";
          return text != '"no-sequences"';
        });
        if (typeRule.length) {
          let typeText = typeRule[0]?.getMatch("TYPE")?.text() || "";
          if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
            noSequences.type = typeText.substring(1, typeText.length - 1);
          }
        }
      }
    }
    if (noSequences.type != "nothing") {
      delete sectorData.rules['"no-sequences"'];
      if (
        typeof noSequences.allowInParentheses == "boolean" &&
        noSequences.allowInParenthesesExists == true
      ) {
        sectorData.rules['"no-sequences"'] =
          `["${noSequences.type}", {"allowInParentheses": ${noSequences.allowInParentheses}}]`;
      } else {
        sectorData.rules['"no-sequences"'] = `["${noSequences.type}"]`;
      }
    }
    // end no-constructor-return and no-sequences section
    // ============================================
    // COMPREHENSIVE EXTENDS MIGRATION SYSTEM
    // Handles all extends cases from ESLint v8 to v9
    // ============================================

    /**
     * Comprehensive extends migration function
     * Handles:
     * - ESLint built-in configs (eslint:recommended, eslint:all)
     * - Popular shared configs (airbnb, prettier, etc.)
     * - Plugin configs (plugin:react/recommended, etc.)
     * - Scoped packages (@typescript-eslint/eslint-recommended)
     * - Configs that changed names in v9
     * - Configs that need to be converted to plugins
     * - Unsupported configs (with TODO comments)
     */
    function migrateExtends(extendsValue: string): {
      result: string; // Direct config object reference (e.g., "js.configs.recommended")
      import?: string;
      needsPrettierPlugin?: boolean;
      pluginName?: string; // Plugin name for registration in plugins object
      pluginImportName?: string; // Import name for the plugin
      isDirectConfig?: boolean; // If true, result should be spread directly in array, not in extends
      needsManualConversion?: boolean; // If true, plugin needs manual rules/globals spreading
      isAngularPlugin?: boolean; // If true, this is an Angular plugin requiring special handling
    } {
      const extendValue = extendsValue.trim();

      // ============================================
      // 1. ESLint Built-in Configs
      // ============================================
      // CRITICAL: extends does NOT work in flat config - must use direct config objects
      if (extendValue === "eslint:recommended") {
        return {
          result: "js.configs.recommended",
          import: 'import js from "@eslint/js";',
          isDirectConfig: true, // Must be spread directly in array, not in extends
        };
      }
      if (extendValue === "eslint:all") {
        return {
          result: "js.configs.all",
          import: 'import js from "@eslint/js";',
          isDirectConfig: true, // Must be spread directly in array, not in extends
        };
      }

      // ============================================
      // 2. Popular Shared Configs
      // ============================================
      const sharedConfigs: Record<string, { import: string; result: string }> = {
        // Airbnb configs
        airbnb: { import: 'import airbnb from "eslint-config-airbnb";', result: "airbnb" },
        "eslint-config-airbnb": {
          import: 'import airbnb from "eslint-config-airbnb";',
          result: "airbnb",
        },
        "airbnb-base": {
          import: 'import airbnbBase from "eslint-config-airbnb-base";',
          result: "airbnbBase",
        },
        "eslint-config-airbnb-base": {
          import: 'import airbnbBase from "eslint-config-airbnb-base";',
          result: "airbnbBase",
        },
        "airbnb-typescript": {
          import: 'import airbnbTypescript from "eslint-config-airbnb-typescript";',
          result: "airbnbTypescript",
        },
        "eslint-config-airbnb-typescript": {
          import: 'import airbnbTypescript from "eslint-config-airbnb-typescript";',
          result: "airbnbTypescript",
        },

        // Prettier configs
        prettier: { import: 'import prettier from "eslint-config-prettier";', result: "prettier" },
        "eslint-config-prettier": {
          import: 'import prettier from "eslint-config-prettier";',
          result: "prettier",
        },

        // Standard configs
        standard: { import: 'import standard from "eslint-config-standard";', result: "standard" },
        "eslint-config-standard": {
          import: 'import standard from "eslint-config-standard";',
          result: "standard",
        },
        "standard-with-typescript": {
          import: 'import standardWithTypescript from "eslint-config-standard-with-typescript";',
          result: "standardWithTypescript",
        },
        "eslint-config-standard-with-typescript": {
          import: 'import standardWithTypescript from "eslint-config-standard-with-typescript";',
          result: "standardWithTypescript",
        },

        // Google configs
        google: { import: 'import google from "eslint-config-google";', result: "google" },
        "eslint-config-google": {
          import: 'import google from "eslint-config-google";',
          result: "google",
        },

        // XO configs
        xo: { import: 'import xo from "eslint-config-xo";', result: "xo" },
        "eslint-config-xo": { import: 'import xo from "eslint-config-xo";', result: "xo" },
        "xo-typescript": {
          import: 'import xoTypescript from "eslint-config-xo-typescript";',
          result: "xoTypescript",
        },
        "eslint-config-xo-typescript": {
          import: 'import xoTypescript from "eslint-config-xo-typescript";',
          result: "xoTypescript",
        },
      };

      if (sharedConfigs[extendValue]) {
        return sharedConfigs[extendValue];
      }

      // ============================================
      // 3. Plugin Configs (plugin:xxx/yyy)
      // ============================================
      const pluginConfigPattern = /^plugin:([^/]+)\/(.+)$/;
      const pluginMatch = extendValue.match(pluginConfigPattern);

      if (pluginMatch && pluginMatch[1] && pluginMatch[2]) {
        const pluginName = pluginMatch[1];
        const configName = pluginMatch[2];

        // Special handling for prettier plugin
        if (pluginName === "prettier" && configName === "recommended") {
          return {
            result: "",
            needsPrettierPlugin: true,
          };
        }

        // Plugins that are known to support flat config with their package names
        const flatConfigSupportedPlugins: Record<
          string,
          { packageName: string; importName: string }
        > = {
          // React
          react: { packageName: "eslint-plugin-react", importName: "react" },
          "react-hooks": { packageName: "eslint-plugin-react-hooks", importName: "reactHooks" },
          "react-native": { packageName: "eslint-plugin-react-native", importName: "reactNative" },

          // Vue
          vue: { packageName: "eslint-plugin-vue", importName: "vue" },

          // TypeScript
          "typescript-eslint": {
            packageName: "@typescript-eslint/eslint-plugin",
            importName: "typescriptEslint",
          },
          "@typescript-eslint": {
            packageName: "@typescript-eslint/eslint-plugin",
            importName: "typescriptEslint",
          },

          // Testing
          jest: { packageName: "eslint-plugin-jest", importName: "jest" },
          vitest: { packageName: "eslint-plugin-vitest", importName: "vitest" },
          "testing-library": {
            packageName: "eslint-plugin-testing-library",
            importName: "testingLibrary",
          },
          playwright: { packageName: "eslint-plugin-playwright", importName: "playwright" },

          // Node.js
          n: { packageName: "eslint-plugin-n", importName: "n" },
          node: { packageName: "eslint-plugin-node", importName: "node" },

          // Import/Export
          import: { packageName: "eslint-plugin-import", importName: "importPlugin" },
          "unused-imports": {
            packageName: "eslint-plugin-unused-imports",
            importName: "unusedImports",
          },

          // Security
          security: { packageName: "eslint-plugin-security", importName: "security" },
          sonarjs: { packageName: "eslint-plugin-sonarjs", importName: "sonarjs" },

          // Code Quality
          unicorn: { packageName: "eslint-plugin-unicorn", importName: "unicorn" },
          promise: { packageName: "eslint-plugin-promise", importName: "promise" },
          compat: { packageName: "eslint-plugin-compat", importName: "compat" },

          // Framework specific
          ember: { packageName: "eslint-plugin-ember", importName: "ember" },
          qunit: { packageName: "eslint-plugin-qunit", importName: "qunit" },
          angular: { packageName: "@angular-eslint/eslint-plugin", importName: "angular" },
          "@angular-eslint": {
            packageName: "@angular-eslint/eslint-plugin",
            importName: "angular",
          },

          // Accessibility
          "jsx-a11y": { packageName: "eslint-plugin-jsx-a11y", importName: "jsxA11y" },

          // Documentation
          jsdoc: { packageName: "eslint-plugin-jsdoc", importName: "jsdoc" },

          // Styling
          tailwindcss: { packageName: "eslint-plugin-tailwindcss", importName: "tailwindcss" },

          // GraphQL
          graphql: { packageName: "eslint-plugin-graphql", importName: "graphql" },

          // Next.js
          next: { packageName: "@next/eslint-plugin-next", importName: "next" },
          "@next": { packageName: "@next/eslint-plugin-next", importName: "next" },
        };

        // Check if plugin is in our supported list
        const pluginInfo = flatConfigSupportedPlugins[pluginName];

        if (pluginInfo) {
          // Generate import name from plugin name if not in map
          const importName =
            pluginInfo.importName ||
            pluginName
              .replace(/^@/, "")
              .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
              .replace(/^([a-z])/, (_, letter) => letter.toUpperCase());

          const packageName =
            pluginInfo.packageName ||
            (pluginName.startsWith("@") ? pluginName : `eslint-plugin-${pluginName}`);

          // CRITICAL: extends does NOT work in flat config - must use direct config objects
          // For plugins with flat config support (like ember), try /recommended export first
          // For other plugins, use manual conversion with plugin.configs

          // Special handling for plugins known to have /recommended flat config export
          const pluginsWithRecommendedExport = ["ember"];
          if (pluginsWithRecommendedExport.includes(pluginName) && configName === "recommended") {
            // Use /recommended export (e.g., eslint-plugin-ember/recommended)
            // No plugin registration needed - these are standalone config objects
            const recommendedImportName = `${importName}Recommended`;
            return {
              result: `${recommendedImportName}.configs.base`, // Will add all configs separately
              import: `import ${recommendedImportName} from "${packageName}/recommended";`,
              isDirectConfig: true, // Must be spread directly in array
              // No pluginName/pluginImportName - don't register in plugins object
            };
          }

          // Plugins that don't have flat config support - need manual conversion
          // These plugins need their rules and globals spread manually in a config object
          const pluginsWithoutFlatConfig = ["qunit", "n"];

          // Angular ESLint plugins - require special handling (no flat config support)
          // They need separate configs for TypeScript and HTML files, plus parser imports
          const angularPlugins = ["angular", "@angular-eslint"];
          const isAngularPlugin = angularPlugins.includes(pluginName);

          if (pluginsWithoutFlatConfig.includes(pluginName) || isAngularPlugin) {
            // Return empty result - will be handled by adding plugin to plugins object
            // Rules and globals will need to be manually spread (handled separately)
            return {
              result: "", // Empty - plugin will be registered, rules/globals added manually
              import: `import ${importName} from "${packageName}";`,
              pluginName: pluginName,
              pluginImportName: importName,
              needsManualConversion: true, // Flag to indicate manual conversion needed
              isAngularPlugin: isAngularPlugin, // Special flag for Angular
            };
          }

          // For other plugins, try to use plugin.configs["flat/config"]
          // This requires plugin to be registered in plugins object
          const configPath = `${importName}.configs["flat/${configName}"]`;

          return {
            result: configPath,
            import: `import ${importName} from "${packageName}";`,
            pluginName: pluginName, // Name used in plugins object
            pluginImportName: importName, // Import name for the plugin
            isDirectConfig: true, // Must be spread directly in array, not in extends
          };
        } else {
          // Plugin not in our list - keep in extends with TODO (unknown how to migrate)
          // Return empty result - will be added to extendsUnknown
          return {
            result: `"${extendValue}"`, // Keep original string in extends
            // No import - user needs to figure it out
          };
        }
      }

      // ============================================
      // 4. Scoped Package Configs (@scope/package)
      // ============================================
      if (extendValue.startsWith("@")) {
        // Check for known scoped configs
        const scopedConfigs: Record<string, { import: string; result: string }> = {
          // TypeScript ESLint - use string format for defineConfig
          "@typescript-eslint/eslint-recommended": {
            import: 'import typescriptEslint from "@typescript-eslint/eslint-plugin";',
            result: '"@typescript-eslint/flat/recommended"',
          },
          "@typescript-eslint/recommended": {
            import: 'import typescriptEslint from "@typescript-eslint/eslint-plugin";',
            result: '"@typescript-eslint/flat/recommended"',
          },
          "@typescript-eslint/recommended-requiring-type-checking": {
            import: 'import typescriptEslint from "@typescript-eslint/eslint-plugin";',
            result: '"@typescript-eslint/flat/recommended-type-checked"',
          },
          "@typescript-eslint/strict": {
            import: 'import typescriptEslint from "@typescript-eslint/eslint-plugin";',
            result: '"@typescript-eslint/flat/strict"',
          },

          // Next.js - these are config objects, use directly
          "@next/eslint-config-next": {
            import: 'import nextConfig from "@next/eslint-config-next";',
            result: "...nextConfig",
          },
        };

        if (scopedConfigs[extendValue]) {
          return scopedConfigs[extendValue];
        }

        // Unknown scoped config - keep in extends with TODO (unknown how to migrate)
        return {
          result: `"${extendValue}"`, // Keep original string in extends
          // No import - user needs to figure it out
        };
      }

      // ============================================
      // 5. Configs that changed names in v9
      // ============================================
      const renamedConfigs: Record<string, string> = {
        // Note: Add any configs that were renamed in v9 here
      };

      if (renamedConfigs[extendValue]) {
        return {
          result: renamedConfigs[extendValue],
        };
      }

      // ============================================
      // 6. Configs that need to be converted to plugins
      // ============================================
      // Some configs in v8 were actually plugins in disguise
      // These should be converted to plugin imports
      const pluginConvertedConfigs: Record<string, { import: string; result: string }> = {
        // Add any configs that should be converted to plugins here
      };

      if (pluginConvertedConfigs[extendValue]) {
        return pluginConvertedConfigs[extendValue];
      }

      // ============================================
      // 7. Unknown/Unsupported Configs
      // ============================================
      // If we get here, we don't know how to handle this config
      // Keep it in extends with TODO comment
      return {
        result: `"${extendValue}"`, // Keep original string in extends
        // No import - user needs to figure it out
      };
    }

    // Extract extends from the sector
    let extendsRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          regex: '"extends"',
        },
      },
    });

    const extendsToProcess: string[] = [];

    if (extendsRule) {
      // Check if extends is an array or single string
      let isArrayRule = extendsRule.findAll({
        rule: {
          kind: "string",
          pattern: "$STRING",
          inside: {
            kind: "array",
          },
        },
      });

      if (isArrayRule.length) {
        // Array of extends
        for (let extendNode of isArrayRule) {
          let extendText = extendNode.getMatch("STRING")?.text() || "";
          // Remove quotes from JSON string
          if (extendText[0] == '"' && extendText[extendText.length - 1] == '"') {
            extendText = extendText.substring(1, extendText.length - 1);
          }
          extendsToProcess.push(extendText);
        }
      } else {
        // Single string extends
        let extendsExecute = extendsRule.find({
          rule: {
            kind: "string",
          },
        });
        let extendText = extendsExecute?.text() || "";
        if (extendText[0] == '"' && extendText[extendText.length - 1] == '"') {
          extendText = extendText.substring(1, extendText.length - 1);
        }
        if (extendText) {
          extendsToProcess.push(extendText);
        }
      }
    }

    // Process each extend
    // Separate known configs (direct spreading) from unknown configs (keep in extends with TODO)
    let needsPrettierPluginFlag = false;
    const directConfigs: string[] = []; // Known configs to spread directly in array (e.g., js.configs.recommended)
    const unknownExtends: string[] = []; // Unknown configs to keep in extends property with TODO
    const todoComments: string[] = []; // TODO comments to add in object

    for (const extendValue of extendsToProcess) {
      const migration = migrateExtends(extendValue);

      if (migration.needsPrettierPlugin) {
        needsPrettierPluginFlag = true;
      }

      if (migration.import && !imports.includes(migration.import)) {
        imports.push(migration.import);
      }

      // Handle plugins that need manual conversion (no flat config support)
      // These have a replacement (plugin registration), so don't keep in extends
      if (migration.needsManualConversion && migration.pluginName && migration.pluginImportName) {
        // Register plugin
        if (!sectorData.plugins[migration.pluginName]) {
          sectorData.plugins[migration.pluginName] = migration.pluginImportName;
        }

        // Special handling for Angular plugins
        if (migration.isAngularPlugin) {
          const rawConfigName = extendValue.match(/plugin:([^/]+)\/(.+)$/)?.[2] || "recommended";
          const isTemplateConfig = extendValue.includes("template");

          if (isTemplateConfig && !rawConfigName.includes("process-inline-templates")) {
            // Angular template plugin needs template parser
            if (
              !imports.includes(
                'import angularTemplate from "@angular-eslint/eslint-plugin-template";'
              )
            ) {
              imports.push('import angularTemplate from "@angular-eslint/eslint-plugin-template";');
            }
            if (
              !imports.includes('import templateParser from "@angular-eslint/template-parser";')
            ) {
              imports.push('import templateParser from "@angular-eslint/template-parser";');
            }
            if (!sectorData.plugins["@angular-eslint/template"]) {
              sectorData.plugins["@angular-eslint/template"] = "angularTemplate";
            }

            // Mark that we need to create Angular template config
            needsAngularConfigs = true;
            angularConfigInfo = {
              pluginImportName: migration.pluginImportName,
              hasInlineTemplates: false,
            };
          } else if (!isTemplateConfig) {
            // Angular main plugin needs TypeScript parser and template plugin
            if (
              !imports.includes(
                'import angularTemplate from "@angular-eslint/eslint-plugin-template";'
              )
            ) {
              imports.push('import angularTemplate from "@angular-eslint/eslint-plugin-template";');
            }
            if (
              !imports.includes('import templateParser from "@angular-eslint/template-parser";')
            ) {
              imports.push('import templateParser from "@angular-eslint/template-parser";');
            }
            if (!imports.includes('import typescriptParser from "@typescript-eslint/parser";')) {
              imports.push('import typescriptParser from "@typescript-eslint/parser";');
            }
            if (!sectorData.plugins["@angular-eslint/template"]) {
              sectorData.plugins["@angular-eslint/template"] = "angularTemplate";
            }

            const hasInlineTemplates = extendsToProcess.some((ext) =>
              ext.includes("plugin:@angular-eslint/template/process-inline-templates")
            );

            // Mark that we need to create Angular configs
            needsAngularConfigs = true;
            angularConfigInfo = {
              pluginImportName: migration.pluginImportName,
              hasInlineTemplates: hasInlineTemplates,
            };
          }
        } else {
          // Generic manual conversion TODO for other plugins
          const configName = extendValue.match(/plugin:([^/]+)\/(.+)$/)?.[2] || "recommended";
          todoComments.push(
            `// TODO: Manually convert "${extendValue}" - This plugin doesn't support flat config. You need to spread its rules and globals manually. Example: { plugins: { ${migration.pluginName}: ${migration.pluginImportName} }, rules: { ...${migration.pluginImportName}.configs.${configName}.rules }, languageOptions: { globals: { ...(${migration.pluginImportName}.configs.${configName}.globals || {}) } } } `
          );
        }
        // Don't add to unknownExtends - plugin is registered as replacement
      } else if (migration.result) {
        // Check if this is a TODO comment
        if (
          migration.result.includes("TODO") ||
          migration.result.includes("/*") ||
          migration.result.includes("//")
        ) {
          todoComments.push(migration.result);
        } else if (migration.isDirectConfig) {
          // Known config - spread directly in array
          directConfigs.push(migration.result);

          // Special handling for ember/recommended - need to add all configs
          if (migration.result.includes("emberRecommended.configs.base")) {
            directConfigs.push("emberRecommended.configs.gjs");
            directConfigs.push("emberRecommended.configs.gts");
          }
        } else if (migration.result.startsWith('"') && migration.result.endsWith('"')) {
          // Unknown config (quoted string) - keep in extends with TODO
          // Only if it doesn't have a replacement (plugin registration, etc.)
          unknownExtends.push(migration.result);
        } else {
          // Other unknown format - keep in extends
          unknownExtends.push(`"${extendValue}"`);
        }
      } else if (!migration.result && !migration.needsPrettierPlugin) {
        // No result and not prettier - this is unknown, keep original value in extends
        // Only if it doesn't have a replacement
        unknownExtends.push(`"${extendValue}"`);
      }

      // Register plugin in plugins object if needed (for plugins with flat config)
      // Don't register ember - it uses standalone config objects
      if (
        migration.pluginName &&
        migration.pluginImportName &&
        !migration.needsManualConversion &&
        migration.pluginName !== "ember"
      ) {
        if (!sectorData.plugins[migration.pluginName]) {
          sectorData.plugins[migration.pluginName] = migration.pluginImportName;
        }
      }
    }

    // Store configs separately
    sectorData.extends = directConfigs; // Known configs - will be spread directly in array
    sectorData.extendsUnknown = unknownExtends; // Unknown configs - will be kept in extends property with TODO
    sectorData.extendsTodoComments = todoComments; // TODO comments - will be added in object

    // Handle plugin:prettier/recommended specially (needs manual setup)
    if (needsPrettierPluginFlag) {
      needsPrettierPlugin = true;
      // Add necessary imports
      if (!imports.includes('import prettierPlugin from "eslint-plugin-prettier";')) {
        imports.push('import prettierPlugin from "eslint-plugin-prettier";');
      }
      if (!imports.includes('import eslintConfigPrettier from "eslint-config-prettier";')) {
        imports.push('import eslintConfigPrettier from "eslint-config-prettier";');
      }
    }
    // ============================================
    // END COMPREHENSIVE EXTENDS MIGRATION
    // ============================================
    // start execute no-unused-vars
    let noUnusedVars = {
      type: "nothing",
      options: {
        caughtErrors: "none",
      } as Record<string, any>,
    };
    let noUnusedVarsRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          pattern: '"no-unused-vars"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noUnusedVarsRule) {
      let isArrayRule = noUnusedVarsRule.findAll({
        rule: {
          kind: "string",
          pattern: "$TYPE",
          inside: {
            kind: "array",
          },
        },
      });
      if (isArrayRule.length) {
        let typeText = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
          noUnusedVars.type = typeText.substring(1, typeText.length - 1);
        }
        let optionsRule = noUnusedVarsRule.findAll({
          rule: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
            inside: {
              kind: "object",
              inside: {
                kind: "array",
              },
            },
          },
        });
        for (let option of optionsRule) {
          let identifier = option.getMatch("IDENTIFIER")?.text();
          if (!identifier) continue;
          let value: any = option
            .text()
            .trim()
            .replace(`${identifier}:`, "")
            .trim()
            .replace(/,\s*$/, "");
          if (value == "true" || value == "false") {
            value = value == "true" ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          }
          // Remove quotes from identifier
          if (identifier[0] == '"' && identifier[identifier.length - 1] == '"') {
            identifier = identifier.substring(1, identifier.length - 1);
          }
          noUnusedVars.options[identifier] = value;
        }
      } else {
        let typeRule = noUnusedVarsRule.findAll({
          rule: {
            kind: "string",
            pattern: "$TYPE",
          },
        });
        typeRule = typeRule.filter((rule) => {
          let text = rule.getMatch("TYPE")?.text() || "";
          return text != '"no-unused-vars"';
        });
        if (typeRule.length) {
          let typeText = typeRule[0]?.getMatch("TYPE")?.text() || "";
          if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
            noUnusedVars.type = typeText.substring(1, typeText.length - 1);
          }
        }
      }
    }
    if (noUnusedVars.type !== "nothing") {
      delete sectorData.rules['"no-unused-vars"'];
      if (Object.keys(noUnusedVars.options).length) {
        sectorData.rules['"no-unused-vars"'] = `["${
          noUnusedVars.type
        }", ${JSON.stringify(noUnusedVars.options)}]`;
      } else {
        sectorData.rules['"no-unused-vars"'] = `["${noUnusedVars.type}"]`;
      }
    }
    // end execute no-unused-vars
    // start no-useless-computed-key
    let noUselessComputedKeys = {
      type: "nothing",
      options: {
        enforceForClassMembers: false,
      } as Record<string, any>,
    };
    let noUselessComputedVarsRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          pattern: '"no-useless-computed-key"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noUselessComputedVarsRule) {
      let isArrayRule = noUselessComputedVarsRule.findAll({
        rule: {
          kind: "string",
          pattern: "$TYPE",
          inside: {
            kind: "array",
          },
        },
      });
      if (isArrayRule.length) {
        let typeText = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
          noUselessComputedKeys.type = typeText.substring(1, typeText.length - 1);
        }
        let optionsRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
            inside: {
              kind: "object",
              inside: {
                kind: "array",
              },
            },
          },
        });
        for (let option of optionsRule) {
          let identifier = option.getMatch("IDENTIFIER")?.text();
          if (!identifier) continue;
          let value = option
            .text()
            .trim()
            .replace(`${identifier}:`, "")
            .trim()
            .replace(/,\s*$/, "");
          // Remove quotes from identifier
          if (identifier[0] == '"' && identifier[identifier.length - 1] == '"') {
            identifier = identifier.substring(1, identifier.length - 1);
          }
          noUselessComputedKeys.options[identifier] = value;
        }
      } else {
        let typeRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: "string",
            pattern: "$TYPE",
          },
        });
        typeRule = typeRule.filter((rule) => {
          let text = rule.getMatch("TYPE")?.text() || "";
          return text != '"no-useless-computed-key"';
        });
        if (typeRule.length) {
          let typeText = typeRule[0]?.getMatch("TYPE")?.text() || "";
          if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
            noUselessComputedKeys.type = typeText.substring(1, typeText.length - 1);
          }
        }
      }
    }
    if (noUselessComputedKeys.type != "nothing") {
      delete sectorData.rules['"no-useless-computed-key"'];
      sectorData.rules['"no-useless-computed-key"'] =
        `["${noUselessComputedKeys.type}", {enforceForClassMembers: ${noUselessComputedKeys.options.enforceForClassMembers}}]`;
    }
    // end no-useless-computed-key
    // start camelcase
    let camelcase = {
      type: "nothing",
      options: {} as Record<string, any>,
    };
    let camelcaseRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          pattern: '"camelcase"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (camelcaseRule) {
      let isArrayRule = camelcaseRule.findAll({
        rule: {
          kind: "string",
          pattern: "$TYPE",
          inside: {
            kind: "array",
          },
        },
      });
      if (isArrayRule.length) {
        let typeText = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
          camelcase.type = typeText.substring(1, typeText.length - 1);
        }
        let optionsRule = camelcaseRule.findAll({
          rule: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
            inside: {
              kind: "object",
              inside: {
                kind: "array",
              },
            },
          },
        });
        for (let option of optionsRule) {
          let identifier = option.getMatch("IDENTIFIER")?.text();
          if (!identifier) continue;
          let value: any = option
            .text()
            .trim()
            .replace(`${identifier}:`, "")
            .trim()
            .replace(/,\s*$/, "");
          if (value == "true" || value == "false") {
            value = value == "true" ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          }
          // Remove quotes from identifier
          if (identifier[0] == '"' && identifier[identifier.length - 1] == '"') {
            identifier = identifier.substring(1, identifier.length - 1);
          }
          if (identifier == "allow") {
            let isUsingArray = option.find({
              rule: {
                kind: "array",
                pattern: "[$$$ITEMS]",
                inside: {
                  kind: "pair",
                },
              },
            });
            let items = isUsingArray?.getMultipleMatches("ITEMS");
            if (
              !items?.filter((item) => {
                let text = item.text();
                return text[0] != '"' && text != ",";
              }).length
            ) {
              camelcase.options[identifier] = value;
            }
          } else {
            camelcase.options[identifier] = value;
          }
        }
      } else {
        let typeRule = camelcaseRule.findAll({
          rule: {
            kind: "string",
            pattern: "$TYPE",
          },
        });
        typeRule = typeRule.filter((rule) => {
          let text = rule.getMatch("TYPE")?.text() || "";
          return text != '"camelcase"';
        });
        if (typeRule.length) {
          let typeText = typeRule[0]?.getMatch("TYPE")?.text() || "";
          if (typeText[0] == '"' && typeText[typeText.length - 1] == '"') {
            camelcase.type = typeText.substring(1, typeText.length - 1);
          }
        }
      }
    }
    if (camelcase.type != "nothing") {
      delete sectorData.rules['"camelcase"'];
      sectorData.rules['"camelcase"'] = `["${camelcase.type}", ${JSON.stringify(
        camelcase.options
      )}]`;
    }
    // end camelcase

    // start detecting no-restricted-imports
    const noRestrictedImportsRule = sector.findAll({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          pattern: '"no-restricted-imports"',
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    for (let noRestrictedImports of noRestrictedImportsRule) {
      let paths = noRestrictedImports.findAll({
        rule: {
          kind: "object",
          has: {
            kind: "pair",
            pattern: "$PAIR",
            has: {
              kind: "string",
              regex: '"name"',
            },
          },
          inside: {
            kind: "array",
            inside: {
              kind: "pair",
              has: {
                kind: "string",
                regex: '"paths"',
              },
              inside: {
                kind: "object",
                inside: {
                  kind: "array",
                  has: {
                    kind: "string",
                    pattern: "$TYPE",
                  },
                },
              },
            },
          },
        },
      });
      if (paths.length) {
        let noRestrictedImportsType = paths[0]?.getMatch("TYPE")?.text();
        if (
          noRestrictedImportsType?.[0] == '"' &&
          noRestrictedImportsType?.[noRestrictedImportsType.length - 1] == '"'
        ) {
          noRestrictedImportsType = noRestrictedImportsType.substring(
            1,
            noRestrictedImportsType.length - 1
          );
        }
        let finalPaths: { name: string; content: string }[] = [];
        for (let [_index, path] of paths.entries()) {
          let pair = path.getMatch("PAIR");
          let nameRule = pair?.find({
            rule: {
              kind: "string",
              not: {
                regex: '"name"',
              },
              pattern: "$NAME",
            },
          });
          if (nameRule) {
            let name = nameRule.getMatch("NAME")?.text();
            if (!name) continue;
            finalPaths.push({
              name,
              content: path.text(),
            });
          }
        }
        const pathsByName = new Map<string, { name: string; content: string }>();
        for (const path of finalPaths) {
          pathsByName.set(path.name, path);
        }
        finalPaths = Array.from(pathsByName.values());
        delete sectorData.rules['"no-restricted-imports"'];
        let pairs = noRestrictedImports.findAll({
          rule: {
            kind: "pair",
            inside: {
              kind: "object",
              inside: {
                kind: "array",
                inside: {
                  kind: "pair",
                  has: {
                    kind: "string",
                    regex: '"no-restricted-imports"',
                  },
                },
              },
            },
          },
        });
        pairs = pairs.filter((pair) => {
          let pairText = pair.text().trim().replaceAll(" ", "");
          if (pairText.startsWith('"paths":')) {
            return false;
          }
          return true;
        });
        sectorData.rules['"no-restricted-imports"'] =
          `["${noRestrictedImportsType}", {paths: ${finalPaths.map(
            (path) => path.content
          )}, ${pairs.map((pair) => `${pair.text()},`)}}]`;
      }
    }
    // end detecting no-restricted-imports

    // detect globals start
    const globals: Record<string, any> = {};
    const detectGlobalsRule = sector.findAll({
      rule: {
        kind: "pair",
        pattern: "$PAIR",
        has: {
          kind: "string",
          nthChild: 1,
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              regex: '"globals"',
            },
          },
        },
      },
    });
    for (let glob of detectGlobalsRule) {
      let identifier = glob.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = glob.text().trim().replace(`${identifier}:`, "").trim().replace(/,\s*$/, "");
      if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
      }
      if (identifier[0] == '"' && identifier[identifier.length - 1] == '"') {
        identifier = identifier.slice(1, identifier.length - 1);
      }
      globals[identifier] = value;
    }
    // detect globals end
    // start language options detection start
    let languageOptions: Record<string, any> = {
      globals,
      parserOptions: {},
    };
    const detectParserOptions = sector.findAll({
      rule: {
        kind: "pair",
        pattern: "$PAIR",
        has: {
          kind: "string",
          nthChild: 1,
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              regex: '"parserOptions"',
            },
          },
        },
      },
    });
    for (let option of detectParserOptions) {
      let identifier = option.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = option
        .text()
        .trim()
        .replace(`${identifier}:`, "")
        .trim()
        .replace(/,\s*$/, "");
      if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
      }
      // Remove quotes from identifier
      if (identifier[0] == '"' && identifier[identifier.length - 1] == '"') {
        identifier = identifier.substring(1, identifier.length - 1);
      }
      languageOptions[identifier] = value;
    }
    // end language options detection
    // start detecting env
    const detectingEnvRule = sector.findAll({
      rule: {
        kind: "pair",
        pattern: "$PAIR",
        has: {
          kind: "string",
          nthChild: 1,
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "string",
              regex: '"env"',
            },
          },
        },
      },
    });
    for (let env of detectingEnvRule) {
      let identifier = env.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = env.text().trim().replace(`${identifier}:`, "").trim().replace(/,\s*$/, "");
      if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
      }
      // Remove quotes from identifier
      if (identifier[0] == '"' && identifier[identifier.length - 1] == '"') {
        identifier = identifier.substring(1, identifier.length - 1);
      }
      if (value === true) {
        if (!imports.includes(`import globals from "globals";`)) {
          imports.push(`import globals from "globals";`);
        }
        languageOptions.globals[`...globals.${identifier}`] = "";
      } else {
        languageOptions.globals[identifier] = value;
      }
    }
    if (parser) {
      languageOptions.parser = parser;
    }
    sectorData.languageOptions = languageOptions;
    // end detecting env

    // start files detection
    let files = "";
    const filesValueDetection = sector.find({
      rule: {
        kind: "pair",
        pattern: "$PAIR",
        has: {
          kind: "string",
          regex: '"files"',
          pattern: "$IDENTIFIER",
        },
      },
    });
    if (filesValueDetection) {
      let filesIdentifier = filesValueDetection.getMatch("IDENTIFIER")?.text();
      let value = filesValueDetection
        .text()
        .trim()
        .replace(`${filesIdentifier}:`, "")
        .trim()
        .replace(/,\s*$/, "");
      files = value;
    }
    sectorData.files = files as string;
    // end files detection
    sectors.push(sectorData);
  }

  // Add Angular ESLint configurations if needed
  if (needsAngularConfigs && angularConfigInfo) {
    const { pluginImportName, hasInlineTemplates } = angularConfigInfo;

    // Add TypeScript config for Angular
    const tsConfig: SectorData = {
      rules: {},
      extends: [],
      languageOptions: {
        parser: "typescriptParser",
        parserOptions: {
          project: '["tsconfig.json"]',
          createDefaultProgram: true,
        },
      },
      files: '["**/*.ts"]',
      plugins: {
        "@angular-eslint": pluginImportName,
        "@angular-eslint/template": "angularTemplate",
      },
      requireJsdoc: {
        exists: false,
        settings: {},
      },
    };

    // Add processor if inline templates are needed
    if (hasInlineTemplates) {
      // Add processor as a TODO comment - will be handled in make-new-config.ts
      if (!tsConfig.extendsTodoComments) {
        tsConfig.extendsTodoComments = [];
      }
      tsConfig.extendsTodoComments.push(
        `processor: "@angular-eslint/template/extract-inline-html",`
      );
    }

    // Spread Angular config rules directly into the rules object
    tsConfig.rules = {
      [`...${pluginImportName}.configs.recommended.rules`]: "",
    };

    sectors.push(tsConfig);

    // Add HTML config for Angular templates
    const htmlConfig: SectorData = {
      rules: {},
      extends: [],
      languageOptions: {
        parser: "templateParser",
      },
      files: '["**/*.html"]',
      plugins: {
        "@angular-eslint/template": "angularTemplate",
      },
      requireJsdoc: {
        exists: false,
        settings: {},
      },
    };

    // Spread Angular template config rules directly into the rules object
    htmlConfig.rules = {
      [`...angularTemplate.configs.recommended.rules`]: "",
    };

    sectors.push(htmlConfig);
  }

  // Add prettier plugin configuration if needed
  if (needsPrettierPlugin) {
    sectors.push({
      rules: { '"prettier/prettier"': '"error"' },
      extends: [],
      languageOptions: {},
      files: "",
      plugins: { prettier: "prettierPlugin" },
      requireJsdoc: {
        exists: false,
        settings: {},
      },
    });
    // Add eslint-config-prettier at the end
    sectors.push({
      rules: {},
      extends: ["eslintConfigPrettier"],
      languageOptions: {},
      files: "",
      plugins: {},
      requireJsdoc: {
        exists: false,
        settings: {},
      },
    });
  }

  let directory = path.dirname(root.filename()).replace(/[/\\]/g, "-");
  const newSource = makeNewConfig(sectors, imports, directory);
  if (newSource === source) {
    return null;
  }
  return newSource;
}

export default transform;
