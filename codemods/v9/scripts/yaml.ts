import { type SgRoot, type Edit, parse } from "codemod:ast-grep";
import type YAML from "codemod:ast-grep/langs/yaml";
import { type SgNode } from "codemod:ast-grep";
import { getStepOutput } from "codemod:workflow";

async function transform(root: SgRoot<YAML>): Promise<string> {
  const rootNode = root.root();

  // For YAML, we look for the root block_mapping and block_mappings inside overrides array
  let rulesSectorsRule = rootNode.findAll({
    rule: {
      any: [
        {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              regex: "rules",
            },
          },
        },
        {
          kind: "block_mapping",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
              inside: {
                kind: "block_mapping_pair",
                has: {
                  field: "key",
                  regex: "overrides",
                },
              },
            },
          },
        },
      ],
    },
  });

  let imports = ['import {defineConfig} from "eslint/config";'];

  let sectors = [];

  for (let sector of rulesSectorsRule) {
    let sectorData = {
      rules: {} as Record<string, string>,
      extends: [] as string[],
      languageOptions: {} as Record<string, any>,
      files: String() as string,
      requireJsdoc: {
        exists: false,
        settings: {},
      },
    };
    // remove sector overrides
    let overridesRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          regex: "overrides",
        },
      },
    });
    if (overridesRule) {
      let overrides = overridesRule?.text();
      let newSectorText = sector.text();
      newSectorText = newSectorText.replace(overrides, "");
      let newSectorRoot = parse("yaml", newSectorText) as SgRoot<YAML>;
      sector = newSectorRoot.root();
    }

    // start detecting rules
    let rulesRule = sector.findAll({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              regex: "rules",
            },
          },
        },
      },
    });
    for (let rule of rulesRule) {
      let identifer = rule.getMatch("IDENTIFIER")?.text();
      if (!identifer) continue;
      // Get the value part of the mapping pair
      let value = rule.text().trim();
      // Remove the identifier and colon
      let colonIndex = value.indexOf(":");
      if (colonIndex !== -1) {
        value = value.substring(colonIndex + 1).trim();
      }
      // Convert YAML value to JavaScript format
      value = convertYamlValueToJs(value);
      sectorData.rules[`"${identifer}"`] = value;
    }
    // end detecting rules
    // start detecting extends
    let arrayExtendsRule = sector.find({
      rule: {
        kind: "block_sequence",
        inside: {
          kind: "block_mapping_pair",
          has: {
            field: "key",
            regex: "extends",
          },
        },
      },
    });
    if (arrayExtendsRule) {
      let extendsItems = arrayExtendsRule.findAll({
        rule: {
          kind: "string_scalar",
          inside: {
            kind: "block_sequence_item",
          },
        },
      });
      for (let item of extendsItems) {
        let extend = item.text().trim();
        if (extend) {
          sectorData.extends.push(`"${extend}"`);
        }
      }
    } else {
      // Check for single string extends
      let singleExtendsRule = sector.find({
        rule: {
          kind: "block_mapping_pair",
          has: {
            field: "key",
            regex: "extends",
          },
        },
      });
      if (singleExtendsRule) {
        let extendValue = singleExtendsRule.find({
          rule: {
            kind: "string_scalar",
            not: {
              regex: "extends",
            },
          },
        });
        if (extendValue) {
          let extend = extendValue.text().trim();
          sectorData.extends.push(`"${extend}"`);
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
        kind: "block_mapping_pair",
        pattern: "$PAIR",
        has: {
          field: "key",
          any: [
            {
              pattern: "require-jsdoc",
            },
            {
              pattern: "valid-jsdoc",
            },
          ],
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    for (let jsdoc of requireJsdocRule) {
      let identifier = jsdoc.getMatch("IDENTIFIER")?.text();
      if (identifier == "rules") {
        let pair = jsdoc?.getMatch("PAIR")?.text().trim();
        if (!pair) continue;
        // Remove the key part
        let colonIndex = pair.indexOf(":");
        if (colonIndex !== -1) {
          pair = pair.substring(colonIndex + 1).trim();
        }
        // Check if it's a simple string value
        if (!/[-\[]/.test(pair.substring(0, 10))) {
          jsDocs.type = pair;
          continue;
        }
        let jsdocTypeRule = jsdoc.find({
          rule: {
            kind: "string_scalar",
            pattern: "$TYPE",
            inside: {
              kind: "block_sequence_item",
              inside: {
                kind: "block_sequence",
              },
            },
          },
        });
        let jsdocOptionsRule = jsdoc.findAll({
          rule: {
            kind: "block_mapping_pair",
            pattern: "$PAIR",
            has: {
              field: "key",
              pattern: "$OPTION_IDENTIFIER",
            },
            inside: {
              kind: "block_mapping",
              inside: {
                kind: "block_mapping_pair",
                has: {
                  field: "key",
                  pattern: "$SETTING_IDENTIFIER",
                },
                inside: {
                  kind: "block_mapping",
                  inside: {
                    kind: "block_sequence_item",
                  },
                },
              },
            },
          },
        });
        if (jsdocTypeRule) {
          let jsdocType = jsdocTypeRule.getMatch("TYPE")?.text() || "";
          let jsdocOptions: Record<string, string> = {};
          if (jsdocOptionsRule.length) {
            let optionsIdentifier = jsdocOptionsRule[0]
              ?.getMatch("SETTING_IDENTIFIER")
              ?.text();
            if (optionsIdentifier == "require") {
              for (let option of jsdocOptionsRule) {
                let optIdentifier = option
                  .getMatch("OPTION_IDENTIFIER")
                  ?.text();
                if (optIdentifier) {
                  let value = option.text();
                  let colonIndex = value.indexOf(":");
                  if (colonIndex !== -1) {
                    value = value.substring(colonIndex + 1).trim();
                  }
                  jsdocOptions[optIdentifier] = convertYamlValueToJs(value);
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
      imports.push("import {jsdoc} from 'eslint-plugin-jsdoc';");
    }
    // end jsDocs section
    // start no-constructor-return and no-sequences section
    let noConstructorReturn = "";
    let noConstructorReturnRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          pattern: "no-constructor-return",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noConstructorReturnRule) {
      let isArrayRule = noConstructorReturnRule.findAll({
        rule: {
          kind: "string_scalar",
          pattern: "$TYPE",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
            },
          },
        },
      });
      if (isArrayRule.length) {
        noConstructorReturn = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
      } else {
        let typeRule = noConstructorReturnRule.find({
          rule: {
            kind: "string_scalar",
            pattern: "$TYPE",
            not: {
              regex: "no-constructor-return",
            },
          },
        });
        if (typeRule) {
          noConstructorReturn = typeRule.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noConstructorReturn) {
      delete sectorData.rules['"no-constructor-return"'];
      sectorData.rules[
        '"no-constructor-return"'
      ] = `["${noConstructorReturn}"]`;
    }

    let noSequences = {
      type: "nothing",
      allowInParenthesesExists: false,
      allowInParentheses: false,
    };
    let noSequencesRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          pattern: "no-sequences",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noSequencesRule) {
      let isArrayRule = noSequencesRule.findAll({
        rule: {
          kind: "string_scalar",
          pattern: "$TYPE",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
              pattern: "$ARRAY",
            },
          },
        },
      });
      if (isArrayRule.length) {
        let array: SgNode<YAML> | undefined;
        let noSequencesRuleTypeObject = isArrayRule.filter((rule) => {
          let noSequencesRuleType = rule.getMatch("TYPE")?.text() || "";
          let arrayRule = rule.getMatch("ARRAY");
          if (arrayRule) {
            array = arrayRule;
          }
          return ["error", "warn"].includes(noSequencesRuleType) ? true : false;
        });
        if (noSequencesRuleTypeObject.length) {
          let noSequencesRuleType = noSequencesRuleTypeObject[0]?.text()!;
          noSequences.type = noSequencesRuleType;
          let allowInParenthesesOptionRule = array?.find({
            rule: {
              kind: "string_scalar",
              regex: "^allowInParentheses$",
              inside: {
                kind: "block_mapping_pair",
                pattern: "$PAIR",
                inside: {
                  kind: "block_mapping",
                },
              },
            },
          });
          if (allowInParenthesesOptionRule) {
            let allowInParenthesesOption =
              allowInParenthesesOptionRule.getMatch("PAIR")?.text() || "";
            let colonIndex = allowInParenthesesOption.indexOf(":");
            if (colonIndex !== -1) {
              allowInParenthesesOption = allowInParenthesesOption
                .substring(colonIndex + 1)
                .trim();
            }
            noSequences.allowInParentheses =
              allowInParenthesesOption == "true" ? true : false;
            noSequences.allowInParenthesesExists = true;
          }
        }
      } else {
        let typeRule = noSequencesRule.find({
          rule: {
            kind: "string_scalar",
            pattern: "$TYPE",
            not: {
              regex: "no-sequences",
            },
          },
        });
        if (typeRule) {
          noSequences.type = typeRule.getMatch("TYPE")?.text()!;
        }
      }
    }
    if (noSequences.type != "nothing") {
      delete sectorData.rules['"no-sequences"'];
      if (
        typeof noSequences.allowInParentheses == "boolean" &&
        noSequences.allowInParenthesesExists == true
      ) {
        sectorData.rules[
          '"no-sequences"'
        ] = `["${noSequences.type}", {"allowInParentheses": ${noSequences.allowInParentheses}}]`;
      } else {
        sectorData.rules['"no-sequences"'] = `["${noSequences.type}"]`;
      }
    }
    // end no-constructor-return and no-sequences section
    // start "eslint:recommended" and "eslint:all"
    let eslintRecommended = false;
    let eslintAll = false;
    let extendsRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          regex: "extends",
        },
      },
    });
    if (extendsRule) {
      let isArrayRule = extendsRule.findAll({
        rule: {
          kind: "string_scalar",
          pattern: "$STRING",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
            },
          },
        },
      });
      if (isArrayRule.length) {
        const extendsStrings = isArrayRule.map(
          (rule) => rule.getMatch("STRING")?.text() || ""
        );
        if (extendsStrings.includes("eslint:recommended")) {
          eslintRecommended = true;
        }
        if (extendsStrings.includes("eslint:all")) {
          eslintAll = true;
        }
      } else {
        let extendsExecute = extendsRule.find({
          rule: {
            kind: "string_scalar",
            not: {
              regex: "extends",
            },
          },
        });
        let extendsText = extendsExecute?.text() || "";
        if (extendsText == "eslint:recommended") {
          eslintRecommended = true;
        }
        if (extendsText == "eslint:all") {
          eslintAll = true;
        }
      }
    }
    if (eslintRecommended || eslintAll) {
      sectorData.extends = sectorData.extends.filter(
        (extend) => !['"eslint:recommended"', '"eslint:all"'].includes(extend)
      );
      imports.push('import js from "@eslint/js";');
      if (eslintRecommended) {
        sectorData.extends.push("js.configs.recommended");
      }
      if (eslintAll) {
        sectorData.extends.push("js.configs.all");
      }
    }
    // end "eslint:recommended" and "eslint:all"
    // start execute no-unused-vars
    let noUnusedVars = {
      type: "nothing",
      options: {
        caughtErrors: "'none'",
      } as Record<string, any>,
    };
    let noUnusedVarsRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          pattern: "no-unused-vars",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noUnusedVarsRule) {
      let isArrayRule = noUnusedVarsRule.findAll({
        rule: {
          kind: "string_scalar",
          pattern: "$TYPE",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
            },
          },
        },
      });
      if (isArrayRule.length) {
        noUnusedVars.type = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        let optionsRule = noUnusedVarsRule.findAll({
          rule: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$OPTION_IDENTIFIER",
            },
            inside: {
              kind: "block_mapping",
              inside: {
                kind: "block_sequence_item",
                inside: {
                  kind: "block_sequence",
                },
              },
            },
          },
        });
        for (let option of optionsRule) {
          let identifier = option.getMatch("OPTION_IDENTIFIER")?.text();
          if (!identifier) continue;
          let value: any = option.text().trim();
          let colonIndex = value.indexOf(":");
          if (colonIndex !== -1) {
            value = value.substring(colonIndex + 1).trim();
          }
          if (value == "true" || value == "false") {
            value = value == "true" ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          }
          noUnusedVars.options[identifier] = value;
        }
      } else {
        let typeRule = noUnusedVarsRule.find({
          rule: {
            kind: "string_scalar",
            pattern: "$TYPE",
            not: {
              regex: "no-unused-vars",
            },
          },
        });
        if (typeRule) {
          noUnusedVars.type = typeRule.getMatch("TYPE")?.text() || "";
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
        kind: "block_mapping_pair",
        has: {
          field: "key",
          pattern: "no-useless-computed-key",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noUselessComputedVarsRule) {
      let isArrayRule = noUselessComputedVarsRule.findAll({
        rule: {
          kind: "string_scalar",
          pattern: "$TYPE",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
            },
          },
        },
      });
      if (isArrayRule.length) {
        noUselessComputedKeys.type =
          isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        let optionsRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
            inside: {
              kind: "block_mapping",
              inside: {
                kind: "block_sequence_item",
                inside: {
                  kind: "block_sequence",
                },
              },
            },
          },
        });
        for (let option of optionsRule) {
          let identifier = option.getMatch("IDENTIFIER")?.text();
          if (!identifier) continue;
          let value = option.text().trim();
          let colonIndex = value.indexOf(":");
          if (colonIndex !== -1) {
            value = value.substring(colonIndex + 1).trim();
          }
          if (value == "true") {
            noUselessComputedKeys.options[identifier] = true;
          } else if (value == "false") {
            noUselessComputedKeys.options[identifier] = false;
          }
        }
      } else {
        let typeRule = noUselessComputedVarsRule.find({
          rule: {
            kind: "string_scalar",
            pattern: "$TYPE",
            not: {
              regex: "no-useless-computed-key",
            },
          },
        });
        if (typeRule) {
          noUselessComputedKeys.type = typeRule.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noUselessComputedKeys.type != "nothing") {
      delete sectorData.rules['"no-useless-computed-key"'];
      sectorData.rules[
        '"no-useless-computed-key"'
      ] = `["${noUselessComputedKeys.type}", {enforceForClassMembers: ${noUselessComputedKeys.options.enforceForClassMembers}}]`;
    }
    // end no-useless-computed-key
    // start camelcase
    let camelcase = {
      type: "nothing",
      options: {} as Record<string, any>,
    };
    let camelcaseRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          field: "key",
          regex: "camelcase",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (camelcaseRule) {
      let isArrayRule = camelcaseRule.findAll({
        rule: {
          kind: "string_scalar",
          pattern: "$TYPE",
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
            },
          },
        },
      });
      if (isArrayRule.length) {
        camelcase.type = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        let optionsRule = camelcaseRule.findAll({
          rule: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$OPTION_IDENTIFIER",
            },
            inside: {
              kind: "block_mapping",
              inside: {
                kind: "block_sequence_item",
                inside: {
                  kind: "block_sequence",
                },
              },
            },
          },
        });
        for (let option of optionsRule) {
          let identifier = option.getMatch("OPTION_IDENTIFIER")?.text();
          if (!identifier) continue;
          let value: any = option.text().trim();
          let colonIndex = value.indexOf(":");
          if (colonIndex !== -1) {
            value = value.substring(colonIndex + 1).trim();
          }
          if (value == "true" || value == "false") {
            value = value == "true" ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          }
          if (identifier == "allow") {
            let isUsingArray = option.find({
              rule: {
                kind: "block_sequence",
                pattern: "$ARRAY",
                inside: {
                  kind: "block_mapping_pair",
                },
              },
            });
            if (isUsingArray) {
              let items = isUsingArray.findAll({
                rule: {
                  kind: "string_scalar",
                  inside: {
                    kind: "block_sequence_item",
                  },
                },
              });
              if (items.length) {
                camelcase.options[identifier] = value;
              }
            }
          } else {
            camelcase.options[identifier] = value;
          }
        }
      } else {
        let typeRule = camelcaseRule.find({
          rule: {
            kind: "string_scalar",
            pattern: "$TYPE",
            not: {
              regex: "camelcase",
            },
          },
        });
        if (typeRule) {
          camelcase.type = typeRule.getMatch("TYPE")?.text() || "";
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
        kind: "block_mapping_pair",
        has: {
          field: "key",
          pattern: "no-restricted-imports",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    for (let noRestrictedImports of noRestrictedImportsRule) {
      let paths = noRestrictedImports.findAll({
        rule: {
          kind: "block_mapping",
          has: {
            kind: "block_mapping_pair",
            pattern: "$PAIR",
            has: {
              field: "key",
              regex: "name",
            },
          },
          inside: {
            kind: "block_sequence_item",
            inside: {
              kind: "block_sequence",
              inside: {
                kind: "block_mapping_pair",
                has: {
                  field: "key",
                  regex: "paths",
                },
                inside: {
                  kind: "block_mapping",
                  inside: {
                    kind: "block_sequence_item",
                    has: {
                      kind: "string_scalar",
                      pattern: "$TYPE",
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (paths.length) {
        let noRestrictedImportsType = paths[0]?.getMatch("TYPE")?.text();
        let finalPaths: { name: string; content: string }[] = [];
        for (let [index, path] of paths.entries()) {
          let pair = path.getMatch("PAIR");
          let nameRule = pair?.find({
            rule: {
              kind: "string_scalar",
              not: {
                regex: "name",
              },
              pattern: "$NAME",
            },
          });
          if (nameRule) {
            let name = nameRule.getMatch("NAME")?.text();
            if (!name) continue;
            let pathContent = convertYamlObjectToJs(path.text());
            finalPaths.push({
              name,
              content: pathContent,
            });
          }
        }
        const pathsByName = new Map<
          string,
          { name: string; content: string }
        >();
        for (const path of finalPaths) {
          pathsByName.set(path.name, path);
        }
        finalPaths = Array.from(pathsByName.values());
        delete sectorData.rules['"no-restricted-imports"'];
        let pairs = noRestrictedImports.findAll({
          rule: {
            kind: "block_mapping_pair",
            inside: {
              kind: "block_mapping",
              inside: {
                kind: "block_sequence_item",
                inside: {
                  kind: "block_sequence",
                  inside: {
                    kind: "block_mapping_pair",
                    has: {
                      field: "key",
                      regex: "no-restricted-imports",
                    },
                  },
                },
              },
            },
          },
        });
        pairs = pairs.filter((pair) => {
          let pairText = pair.text().trim().replaceAll(" ", "");
          if (pairText.startsWith("paths:")) {
            return false;
          }
          return true;
        });
        sectorData.rules[
          '"no-restricted-imports"'
        ] = `["${noRestrictedImportsType}", {paths: [${finalPaths
          .map((path) => path.content)
          .join(", ")}], ${pairs.map((pair) => {
          let pairText = convertYamlPairToJs(pair.text());
          return `${pairText},`;
        })}}]`;
      }
    }
    // end detecting no-restricted-imports

    // detect globals start
    const globals: Record<string, any> = {};
    const detectGlobalsRule = sector.findAll({
      rule: {
        kind: "block_mapping_pair",
        pattern: "$PAIR",
        has: {
          field: "key",
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              regex: "globals",
            },
          },
        },
      },
    });
    for (let glob of detectGlobalsRule) {
      let identifier = glob.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = glob.text().trim();
      let colonIndex = value.indexOf(":");
      if (colonIndex !== -1) {
        value = value.substring(colonIndex + 1).trim();
      }
      if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
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
        kind: "block_mapping_pair",
        pattern: "$PAIR",
        has: {
          field: "key",
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              regex: "parserOptions",
            },
          },
        },
      },
    });
    for (let option of detectParserOptions) {
      let identifier = option.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = option.text().trim();
      let colonIndex = value.indexOf(":");
      if (colonIndex !== -1) {
        value = value.substring(colonIndex + 1).trim();
      }
      if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
      }
      languageOptions[identifier] = value;
    }
    // end language options detection
    // start detecting env
    const detectingEnvRule = sector.findAll({
      rule: {
        kind: "block_mapping_pair",
        pattern: "$PAIR",
        has: {
          field: "key",
          pattern: "$IDENTIFIER",
        },
        inside: {
          kind: "block_mapping",
          inside: {
            kind: "block_mapping_pair",
            has: {
              field: "key",
              regex: "env",
            },
          },
        },
      },
    });
    for (let env of detectingEnvRule) {
      let identifier = env.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = env.text().trim();
      let colonIndex = value.indexOf(":");
      if (colonIndex !== -1) {
        value = value.substring(colonIndex + 1).trim();
      }
      if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
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
    sectorData.languageOptions = languageOptions;
    // end detecting env

    // start files detection
    let files = "";
    const filesValueDetection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        pattern: "$PAIR",
        has: {
          field: "key",
          regex: "files",
          pattern: "$IDENTIFIER",
        },
      },
    });
    if (filesValueDetection) {
      let filesIdentifier = filesValueDetection.getMatch("IDENTIFIER")?.text();
      let value = filesValueDetection.text().trim();
      let colonIndex = value.indexOf(":");
      if (colonIndex !== -1) {
        value = value.substring(colonIndex + 1).trim();
      }
      // Check if it's an array
      if (value.includes("-")) {
        let filesArray = sector.findAll({
          rule: {
            kind: "string_scalar",
            inside: {
              kind: "block_sequence_item",
              inside: {
                kind: "block_sequence",
                inside: {
                  kind: "block_mapping_pair",
                  has: {
                    field: "key",
                    regex: "files",
                  },
                },
              },
            },
          },
        });
        if (filesArray.length) {
          let filesList = filesArray.map((f) => `"${f.text()}"`);
          files = `[${filesList.join(", ")}]`;
        }
      } else {
        files = `"${value}"`;
      }
    }
    sectorData.files = files as string;
    // end files detection
    sectors.push(sectorData);
  }

  let requireJsdocSettings = sectors.find(
    (sector) => sector.requireJsdoc.exists
  )?.requireJsdoc.settings;
  let newEslintConfig = `${imports.join("\n")}\nexport default defineConfig(${
    requireJsdocSettings
      ? `jsdoc({
    config: 'flat/recommended',
    settings: {
        // TODO: Migrate settings manually
        ${Object.entries(requireJsdocSettings)
          .map(([key, value]) => `${key}: ${value}`)
          .join(",\n")}
    },
  }),\n`
      : ``
  }${sectors.map((sector) => {
    const rulesStr = Object.entries(sector.rules)
      .map(([key, value]) => `\n${key}:${value}`)
      .join(", ");
    const extendsStr = sector.extends.join(",");
    let languageOptions = JSON.stringify(sector.languageOptions);
    languageOptions = languageOptions.replace(
      /"(\.\.\.[^"]+)":\s*(?:["']'?"?"|\{\})?,?/g,
      "$1,"
    );
    return `\n{languageOptions: ${languageOptions}, ${
      sector.extends.length ? `extends: [${extendsStr}],\n` : ``
    } rules: {${rulesStr}}\n, ${
      sector.files ? `files: ${sector.files}\n` : ``
    }}`;
  })})`;

  const newSource = newEslintConfig;
  return newSource;
}

// Helper function to convert YAML value to JavaScript format
function convertYamlValueToJs(yamlValue: string): string {
  yamlValue = yamlValue.trim();

  // Handle array format (with -)
  if (yamlValue.startsWith("-")) {
    let lines = yamlValue.split("\n").map((l) => l.trim());
    let result: any[] = [];
    let currentObject: any = null;
    let currentKey = "";

    for (let line of lines) {
      if (line.startsWith("-")) {
        // New array item
        if (currentObject) {
          result.push(currentObject);
          currentObject = null;
        }
        let value = line.substring(1).trim();
        if (value) {
          // Simple value
          if (value == "true" || value == "false") {
            result.push(value === "true");
          } else if (!isNaN(Number(value))) {
            result.push(Number(value));
          } else {
            result.push(`"${value}"`);
          }
        } else {
          // Start of object
          currentObject = {};
        }
      } else if (line.includes(":")) {
        // Object property
        let [keyRaw, ...valueParts] = line.split(":");
        let value = valueParts.join(":").trim();
        let key = keyRaw?.trim();

        if (!key) continue;

        if (!currentObject) {
          currentObject = {};
        }

        if (value == "true" || value == "false") {
          currentObject[key] = value === "true";
        } else if (!isNaN(Number(value))) {
          currentObject[key] = Number(value);
        } else if (value.startsWith("-")) {
          // Nested array
          let arrayItems = value.split("-").filter((v) => v.trim());
          currentObject[key] = arrayItems.map((v) => {
            v = v.trim();
            return !isNaN(Number(v)) ? Number(v) : `"${v}"`;
          });
        } else {
          currentObject[key] = `"${value}"`;
        }
      }
    }

    if (currentObject) {
      result.push(currentObject);
    }

    return JSON.stringify(result);
  }

  // Simple value
  if (yamlValue == "true" || yamlValue == "false") {
    return yamlValue;
  } else if (!isNaN(Number(yamlValue))) {
    return yamlValue;
  } else {
    return `"${yamlValue}"`;
  }
}

// Helper function to convert YAML object to JavaScript object
function convertYamlObjectToJs(yamlObject: string): string {
  let lines = yamlObject
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);
  let obj: any = {};

  for (let line of lines) {
    if (line.includes(":")) {
      let [keyRaw, ...valueParts] = line.split(":");
      let value = valueParts.join(":").trim();
      let key = keyRaw?.trim();

      if (!key) continue;

      if (value == "true" || value == "false") {
        obj[key] = value === "true";
      } else if (!isNaN(Number(value))) {
        obj[key] = Number(value);
      } else {
        obj[key] = value;
      }
    }
  }

  return JSON.stringify(obj);
}

// Helper function to convert YAML pair to JavaScript format
function convertYamlPairToJs(yamlPair: string): string {
  yamlPair = yamlPair.trim();
  if (yamlPair.includes(":")) {
    let [keyRaw, ...valueParts] = yamlPair.split(":");
    let value = valueParts.join(":").trim();
    let key = keyRaw?.trim();

    if (!key) return yamlPair;

    if (value == "true" || value == "false") {
      return `${key}: ${value}`;
    } else if (!isNaN(Number(value))) {
      return `${key}: ${value}`;
    } else {
      return `${key}: "${value}"`;
    }
  }
  return yamlPair;
}

export default transform;
