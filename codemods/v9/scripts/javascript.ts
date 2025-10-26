import { type SgRoot, type Edit, parse } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { type SgNode } from "codemod:ast-grep";
import { getStepOutput } from "codemod:workflow";

async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();

  let rulesSectorsRule = rootNode.findAll({
    rule: {
      any: [
        {
          kind: "object",
          inside: {
            kind: "assignment_expression",
          },
        },
        {
          kind: "object",
          inside: {
            kind: "array",
            inside: {
              kind: "pair",
              has: {
                any: [
                  {
                    kind: "property_identifier",
                    regex: "overrides",
                  },
                  {
                    kind: "string",
                    nthChild: 1,
                    has: {
                      kind: "string_fragment",
                      regex: "overrides",
                    },
                  },
                ],
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
        kind: "pair",
        any: [
          {
            has: {
              kind: "property_identifier",
              regex: "overrides",
            },
          },
          {
            has: {
              kind: "string",
              has: {
                kind: "string_fragment",
                regex: "overrides",
              },
            },
          },
        ],
      },
    });
    if (overridesRule) {
      let overrides = overridesRule?.text();
      let newSectorText = sector.text();
      newSectorText = newSectorText.replace(overrides, "");
      let newSectorRoot = parse("javascript", newSectorText) as SgRoot<JS>;
      sector = newSectorRoot.root();
    }

    // start detecting rules
    let rulesRule = sector.findAll({
      rule: {
        kind: "pair",
        any: [
          {
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
          {
            has: {
              kind: "string",
              nthChild: 1,
              pattern: "$IDENTIFIER",
            },
          },
        ],
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            any: [
              {
                has: {
                  kind: "property_identifier",
                  regex: "rules",
                },
              },
              {
                has: {
                  kind: "string",
                  nthChild: 1,
                  has: {
                    kind: "string_fragment",
                    regex: "rules",
                  },
                },
              },
            ],
          },
        },
      },
    });
    for (let rule of rulesRule) {
      let identifer = rule.getMatch("IDENTIFIER")?.text();
      if (!identifer) continue;
      let value = rule.text().trim().replace(`${identifer}:`, "").trim();
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
            any: [
              {
                kind: "property_identifier",
                regex: "extends",
              },
              {
                kind: "string",
                has: {
                  kind: "string_fragment",
                  regex: "extends",
                },
              },
            ],
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
          any: [
            {
              pattern: "'require-jsdoc'",
            },
            {
              pattern: '"require-jsdoc"',
            },
            {
              pattern: "'valid-jsdoc'",
            },
            {
              pattern: '"valid-jsdoc"',
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    for (let jsdoc of requireJsdocRule) {
      let identifier = jsdoc.getMatch("IDENTIFIER")?.text();
      if (identifier == "rules") {
        let pair = jsdoc
          ?.getMatch("PAIR")
          ?.text()
          .trim()
          .replace("'require-jsdoc':", "")
          .replace('"require-jsdoc":', "")
          .trim();
        if (
          (pair?.[0] == '"' && pair?.[pair.length - 1] == '"') ||
          (pair?.[0] == "'" && pair?.[pair.length - 1] == "'")
        ) {
          jsDocs.type = pair.substring(1, pair.length - 1);
          continue;
        }
        let jsdocTypeRule = jsdoc.find({
          rule: {
            kind: "string_fragment",
            pattern: "$TYPE",
            inside: {
              kind: "string",
              inside: {
                kind: "array",
              },
            },
          },
        });
        let jsdocOptionsRule = jsdoc.findAll({
          rule: {
            kind: "pair",
            pattern: "$PAIR",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
            inside: {
              kind: "object",
              inside: {
                kind: "pair",
                has: {
                  kind: "property_identifier",
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
          let jsdocOptions: Record<string, string> = {};
          if (jsdocOptionsRule.length) {
            let optionsIdentifier = jsdocOptionsRule[0]
              ?.getMatch("SETTING_IDENTIFIER")
              ?.text();
            if (optionsIdentifier == "require") {
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
    delete sectorData.rules["'require-jsdoc'"];
    delete sectorData.rules["'valid-jsdoc'"];
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
        kind: "pair",
        has: {
          kind: "string",
          any: [
            {
              pattern: "'no-constructor-return'",
            },
            {
              pattern: '"no-constructor-return"',
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noConstructorReturnRule) {
      let isArrayRule = noConstructorReturnRule.findAll({
        rule: {
          kind: "string_fragment",
          pattern: "$TYPE",
          inside: {
            kind: "string",
            inside: {
              kind: "array",
            },
          },
        },
      });
      if (isArrayRule.length) {
        noConstructorReturn = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
      } else {
        let typeRule = noConstructorReturnRule.findAll({
          rule: {
            kind: "string_fragment",
            pattern: "$TYPE",
            inside: {
              kind: "string",
            },
          },
        });
        typeRule = typeRule.filter(
          (rule) => rule.getMatch("TYPE")?.text() != "no-constructor-return"
        );
        if (typeRule.length) {
          noConstructorReturn = typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noConstructorReturn) {
      delete sectorData.rules['"no-constructor-return"'];
      delete sectorData.rules["'no-constructor-return'"];
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
        kind: "pair",
        has: {
          kind: "string",
          any: [
            {
              pattern: "'no-sequences'",
            },
            {
              pattern: '"no-sequences"',
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noSequencesRule) {
      let isArrayRule = noSequencesRule.findAll({
        rule: {
          kind: "string_fragment",
          pattern: "$TYPE",
          inside: {
            kind: "string",
            inside: {
              kind: "array",
              pattern: "$ARRAY",
            },
          },
        },
      });
      if (isArrayRule.length) {
        let array: SgNode<JS> | undefined;
        let noSequencesRuleTypeObject = isArrayRule.filter((rule) => {
          let noSequencesRuleType = rule.getMatch("TYPE")?.text() || "";
          let arrayRule = rule.getMatch("ARRAY");
          if (arrayRule) {
            array = arrayRule;
          }
          return ["error", "warn"].includes(noSequencesRuleType) ? true : false;
        });
        if (noSequencesRuleTypeObject) {
          let noSequencesRuleType = noSequencesRuleTypeObject[0]?.text()!;
          noSequences.type = noSequencesRuleType;
          let allowInParenthesesOptionRule = array?.find({
            rule: {
              kind: "property_identifier",
              regex: "^allowInParentheses$",
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
            let allowInParenthesesOption =
              allowInParenthesesOptionRule.getMatch("PAIR")?.text() || "";
            allowInParenthesesOption = allowInParenthesesOption
              .trim()
              .replace("allowInParentheses:", "")
              .trim();
            noSequences.allowInParentheses =
              allowInParenthesesOption == "true" ? true : false;
            noSequences.allowInParenthesesExists = true;
          }
        }
      } else {
        let typeRule = noSequencesRule.findAll({
          rule: {
            kind: "string_fragment",
            pattern: "$TYPE",
            inside: {
              kind: "string",
            },
          },
        });
        typeRule = typeRule.filter(
          (rule) => rule.getMatch("TYPE")?.text() != "no-sequences"
        );
        if (typeRule.length) {
          noSequences.type = typeRule[0]?.getMatch("TYPE")?.text()!;
        }
      }
    }
    if (noSequences.type != "nothing") {
      delete sectorData.rules['"no-sequences"'];
      delete sectorData.rules["'no-sequences'"];
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
        kind: "pair",
        has: {
          kind: "property_identifier",
          regex: "extends",
        },
      },
    });
    if (extendsRule) {
      let isArrayRule = extendsRule.findAll({
        rule: {
          kind: "string_fragment",
          pattern: "$STRING",
          inside: {
            kind: "string",
            inside: {
              kind: "array",
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
            kind: "string_fragment",
            inside: {
              kind: "string",
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
        (extend) =>
          ![
            "'eslint:recommended'",
            '"eslint:recommended"',
            "'eslint:all'",
            '"eslint:all"',
          ].includes(extend)
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
      } as Record<string, string>,
    };
    let noUnusedVarsRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          any: [
            {
              pattern: "'no-unused-vars'",
            },
            {
              pattern: '"no-unused-vars"',
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noUnusedVarsRule) {
      let isArrayRule = noUnusedVarsRule.findAll({
        rule: {
          kind: "string_fragment",
          pattern: "$TYPE",
          inside: {
            kind: "string",
            inside: {
              kind: "array",
            },
          },
        },
      });
      if (isArrayRule.length) {
        noUnusedVars.type = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        let optionsRule = noUnusedVarsRule.findAll({
          rule: {
            kind: "pair",
            has: {
              kind: "property_identifier",
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
          let value: any = option
            .text()
            .trim()
            .replace(`${identifier}:`, "")
            .trim();
          if (!identifier) continue;
          if (
            (value[0] == "'" && value[value.length - 1] == "'") ||
            (value[0] == '"' && value[value.length - 1] == '"')
          ) {
            value = value.slice(1, value.length - 1);
          } else if (value == "true" || value == "false") {
            value = value == "true" ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          }
          noUnusedVars.options[identifier] = value;
        }
      } else {
        let typeRule = noUnusedVarsRule.findAll({
          rule: {
            kind: "string_fragment",
            pattern: "$TYPE",
            inside: {
              kind: "string",
            },
          },
        });
        typeRule = typeRule.filter(
          (rule) => rule.getMatch("TYPE")?.text() != "no-unused-vars"
        );
        if (typeRule.length) {
          noUnusedVars.type = typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noUnusedVars.type !== "nothing") {
      delete sectorData.rules["'no-unused-vars'"];
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
          any: [
            {
              pattern: "'no-useless-computed-key'",
            },
            {
              pattern: '"no-useless-computed-key"',
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (noUselessComputedVarsRule) {
      let isArrayRule = noUselessComputedVarsRule.findAll({
        rule: {
          kind: "string_fragment",
          pattern: "$TYPE",
          inside: {
            kind: "string",
            inside: {
              kind: "array",
            },
          },
        },
      });
      if (isArrayRule.length) {
        noUselessComputedKeys.type =
          isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        let optionsRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: "pair",
            has: {
              kind: "property_identifier",
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
          let value = option.text().trim().replace(`${identifier}:`, "").trim();
          noUselessComputedKeys.options[identifier] = value;
        }
      } else {
        let typeRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: "string_fragment",
            pattern: "$TYPE",
            inside: {
              kind: "string",
            },
          },
        });
        typeRule = typeRule.filter(
          (rule) => rule.getMatch("TYPE")?.text() != "no-useless-computed-key"
        );
        if (typeRule.length) {
          noUselessComputedKeys.type =
            typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noUselessComputedKeys.type != "nothing") {
      delete sectorData.rules["'no-useless-computed-key'"];
      delete sectorData.rules['"no-useless-computed-key"'];
      sectorData.rules[
        '"no-useless-computed-key"'
      ] = `["${noUselessComputedKeys.type}", {enforceForClassMembers: ${noUselessComputedKeys.options.enforceForClassMembers}}]`;
    }
    // end no-useless-computed-key
    // start camelcase
    let camelcase = {
      type: "nothing",
      options: {} as Record<string, string>,
    };
    let camelcaseRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          any: [
            {
              kind: "string",
              any: [
                {
                  pattern: "'camelcase'",
                },
                {
                  pattern: '"camelcase"',
                },
              ],
            },
            {
              kind: "property_identifier",
              regex: "camelcase",
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
          },
        },
      },
    });
    if (camelcaseRule) {
      let isArrayRule = camelcaseRule.findAll({
        rule: {
          kind: "string_fragment",
          pattern: "$TYPE",
          inside: {
            kind: "string",
            inside: {
              kind: "array",
            },
          },
        },
      });
      if (isArrayRule.length) {
        camelcase.type = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        let optionsRule = camelcaseRule.findAll({
          rule: {
            kind: "pair",
            has: {
              kind: "property_identifier",
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
            .trim();
          if (
            (value[0] == "'" && value[value.length - 1] == "'") ||
            (value[0] == '"' && value[value.length - 1] == '"')
          ) {
            value = value.slice(1, value.length - 1);
          } else if (value == "true" || value == "false") {
            value = value == "true" ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
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
                return (
                  text[0] != "'" &&
                  text[0] != '"' &&
                  text[0] != "`" &&
                  text != ","
                );
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
            kind: "string_fragment",
            pattern: "$TYPE",
            inside: {
              kind: "string",
            },
          },
        });
        typeRule = typeRule.filter(
          (rule) => rule.getMatch("TYPE")?.text() != "no-useless-computed-key"
        );
        if (typeRule.length) {
          noUselessComputedKeys.type =
            typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (camelcase.type != "nothing") {
      delete sectorData.rules['"camelcase"'];
      delete sectorData.rules["'camelcase'"];
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
          any: [
            {
              kind: "string",
              any: [
                {
                  pattern: "'no-restricted-imports'",
                },
                {
                  pattern: '"no-restricted-imports"',
                },
              ],
            },
            {
              kind: "property_identifier",
              regex: "camelcase",
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
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
              any: [
                {
                  kind: "property_identifier",
                  regex: "name",
                },
                {
                  kind: "string_fragment",
                  has: {
                    kind: "string",
                    regex: "name",
                  },
                },
              ],
            },
          },
          inside: {
            kind: "array",
            inside: {
              kind: "pair",
              has: {
                any: [
                  {
                    kind: "property_identifier",
                    regex: "paths",
                  },
                  {
                    kind: "string_fragment",
                    has: {
                      kind: "string",
                      regex: "paths",
                    },
                  },
                ],
              },
              inside: {
                kind: "object",
                inside: {
                  kind: "array",
                  has: {
                    kind: "string",
                    has: {
                      kind: "string_fragment",
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
              kind: "string",
              has: {
                kind: "string_fragment",
                not: {
                  regex: "name",
                },
                pattern: "$NAME",
              },
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
        const pathsByName = new Map<
          string,
          { name: string; content: string }
        >();
        for (const path of finalPaths) {
          pathsByName.set(path.name, path);
        }
        finalPaths = Array.from(pathsByName.values());
        delete sectorData.rules['"no-restricted-imports"'];
        delete sectorData.rules["'no-restricted-imports'"];
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
                    has: {
                      kind: "string_fragment",
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
          if (
            pairText.startsWith("paths:") ||
            pairText.startsWith("'paths':") ||
            pairText.startsWith('"paths":')
          ) {
            return false;
          }
          return true;
        });
        sectorData.rules[
          '"no-restricted-imports"'
        ] = `["${noRestrictedImportsType}", {paths: ${finalPaths.map(
          (path) => path.content
        )}, ${pairs.map((pair) => `${pair.text()},`)}}]`;
      }
    }
    // end detecting no-restricted-imports

    // detect globals start
    const globals: Record<string, string> = {};
    const detectGlobalsRule = sector.findAll({
      rule: {
        kind: "pair",
        pattern: "$PAIR",
        has: {
          any: [
            {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
            {
              kind: "string",
              nthChild: 1,
              pattern: "$IDENTIFIER",
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              regex: "globals",
            },
          },
        },
      },
    });
    for (let glob of detectGlobalsRule) {
      let identifier = glob.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = glob.text().trim().replace(`${identifier}:`, "").trim();
      if (
        (value[0] == "'" && value[value.length - 1] == "'") ||
        (value[0] == '"' && value[value.length - 1] == '"')
      ) {
        value = value.slice(1, value.length - 1);
      } else if (value == "true" || value == "false") {
        value = value == "true" ? true : false;
      } else if (!isNaN(value)) {
        value = parseInt(value);
      }
      if (
        (identifier[0] == "'" && identifier[identifier.length - 1] == "'") ||
        (identifier[0] == '"' && identifier[identifier.length - 1] == '"')
      ) {
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
          any: [
            {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
            {
              kind: "string",
              nthChild: 1,
              pattern: "$IDENTIFIER",
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              regex: "parserOptions",
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
        .trim();
      if (
        (value[0] == "'" && value[value.length - 1] == "'") ||
        (value[0] == '"' && value[value.length - 1] == '"')
      ) {
        value = value.slice(1, value.length - 1);
      } else if (value == "true" || value == "false") {
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
        kind: "pair",
        pattern: "$PAIR",
        has: {
          any: [
            {
              kind: "property_identifier",
              pattern: "$IDENTIFIER",
            },
            {
              kind: "string",
              nthChild: 1,
              pattern: "$IDENTIFIER",
            },
          ],
        },
        inside: {
          kind: "object",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              regex: "env",
            },
          },
        },
      },
    });
    for (let env of detectingEnvRule) {
      let identifier = env.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: any = env.text().trim().replace(`${identifier}:`, "").trim();
      if (
        (value[0] == "'" && value[value.length - 1] == "'") ||
        (value[0] == '"' && value[value.length - 1] == '"')
      ) {
        value = value.slice(1, value.length - 1);
      } else if (value == "true" || value == "false") {
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
        kind: "pair",
        pattern: "$PAIR",
        has: {
          any: [
            {
              kind: "property_identifier",
              regex: "files",
              pattern: "$IDENTIFIER",
            },
            {
              kind: "string",
              has: {
                kind: "string_fragment",
                regex: "files",
              },
              pattern: "$IDENTIFIER",
            },
          ],
        },
      },
    });
    if (filesValueDetection) {
      let filesIdentifier = filesValueDetection.getMatch("IDENTIFIER")?.text();
      let value = filesValueDetection
        .text()
        .trim()
        .replace(`${filesIdentifier}:`, "")
        .trim();
      files = value;
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

export default transform;
