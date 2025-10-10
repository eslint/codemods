import { type SgRoot, type Edit, parse } from "codemod:ast-grep";
import type YAML from "codemod:ast-grep/langs/yaml";
import { type SgNode } from "codemod:ast-grep";

async function transform(root: SgRoot<YAML>): Promise<string> {
  const rootNode = root.root();

  // For YAML, we look for the root document and block_mapping inside overrides
  // First, get the main block_mapping (root config)
  let mainBlockMapping = rootNode.find({
    rule: {
      kind: "block_mapping",
      inside: {
        kind: "block_node",
        inside: {
          kind: "document"
        }
      }
    }
  });
  
  let rulesSectorsRule = [];
  
  // Add the main config as a sector
  if(mainBlockMapping) {
    rulesSectorsRule.push(mainBlockMapping);
  }
  
  // Find overrides sections (block_mapping inside block_sequence_item)
  let overridesItems = rootNode.findAll({
    rule: {
      kind: "block_mapping",
      inside: {
        kind: "block_node",
        inside: {
          kind: "block_sequence_item",
          inside: {
            kind: "block_sequence",
            inside: {
              kind: "block_node",
              inside: {
                kind: "block_mapping_pair",
                has: {
                  kind: "flow_node",
                  has: {
                    kind: "plain_scalar",
                    has: {
                      kind: "string_scalar",
                      regex: "overrides"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  
  rulesSectorsRule = [...rulesSectorsRule, ...overridesItems];

  let imports = ['import {defineConfig} from "eslint/config";'];

  let sectors = [];

  for (let sector of rulesSectorsRule) {
    let sectorData = {
      rules: {} as Record<string, string>,
      extends: [] as string[],
      languageOptions: {} as Record<string, any>,
      files: String() as string,
    };
    
    // remove sector overrides
    let overridesRule = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "overrides"
            }
          }
        }
      }
    });
    if(overridesRule) {
      let overrides = overridesRule?.text();
      let newSectorText = sector.text();
      newSectorText = newSectorText.replace(overrides, "");
      let newSectorRoot = parse("yaml", newSectorText) as SgRoot<YAML>;
      let newMapping = newSectorRoot.root().find({
        rule: {
          kind: "block_mapping"
        }
      });
      if(newMapping) {
        sector = newMapping;
      }
    }

    // start detecting rules
    let rulesSection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^rules$"
            }
          }
        }
      }
    });
    
    if(rulesSection) {
      let rulesMapping = rulesSection.find({
        rule: {
          kind: "block_mapping",
          inside: {
            kind: "block_node"
          }
        }
      });
      
      if(rulesMapping) {
        let rulesRule = rulesMapping.findAll({
          rule: {
            kind: "block_mapping_pair"
          }
        });
        
        for (let rule of rulesRule) {
          let keyNode = rule.find({
            rule: {
              kind: "flow_node",
              nthChild: 1,
              has: {
                kind: "plain_scalar",
                has: {
                  kind: "string_scalar",
                  pattern: "$IDENTIFIER"
                }
              }
            }
          });
          
          let identifer = keyNode?.getMatch("IDENTIFIER")?.text();
          if(!identifer) continue;
          
          let value = rule.text().trim().replace(`${identifer}:`, '').trim();
          // Convert YAML value to JavaScript array/object representation
          value = convertYamlValueToJS(value);
          sectorData.rules[`"${identifer}"`] = value;
        }
      }
    }
    // end detecting rules
    
    // start detecting extends
    let extendsSection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^extends$"
            }
          }
        }
      }
    });
    
    if(extendsSection) {
      let extendsSequence = extendsSection.find({
        rule: {
          kind: "block_sequence"
        }
      });
      
      if(extendsSequence) {
        let extendsItems = extendsSequence.findAll({
          rule: {
            kind: "flow_node",
            inside: {
              kind: "block_sequence_item"
            }
          }
        });
        
        for (let item of extendsItems) {
          let extend = item.text().trim();
          if (extend && extend != '-') {
            sectorData.extends.push(`"${extend}"`);
          }
        }
      }
    }
    // end detecting extends

    // Handle special rules
    handleSpecialRules(sector, sectorData);
    
    // start "eslint:recommended" and "eslint:all"
    let eslintRecommended = false;
    let eslintAll = false;
    
    if(extendsSection) {
      let extendsSequence = extendsSection.find({
        rule: {
          kind: "block_sequence"
        }
      });
      
      if(extendsSequence) {
        let items = extendsSequence.findAll({
          rule: {
            kind: "flow_node",
            inside: {
              kind: "block_sequence_item"
            }
          }
        });
        
        for(let item of items) {
          let text = item.text().trim();
          if(text === "eslint:recommended") {
            eslintRecommended = true;
          }
          if(text === "eslint:all") {
            eslintAll = true;
          }
        }
      }
    }
    
    if (eslintRecommended || eslintAll) {
      sectorData.extends = sectorData.extends.filter(extend => !['"eslint:recommended"', '"eslint:all"'].includes(extend));
      if(!imports.includes('import js from "@eslint/js";')) {
        imports.push('import js from "@eslint/js";');
      }
      if (eslintRecommended) {
        sectorData.extends.push("js.configs.recommended");
      } 
      if (eslintAll) {
        sectorData.extends.push("js.configs.all");
      }
    }
    // end "eslint:recommended" and "eslint:all"

    // detect globals start
    const globals: Record<string, any> = {};
    let globalsSection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^globals$"
            }
          }
        }
      }
    });
    
    if(globalsSection) {
      let globalsMapping = globalsSection.find({
        rule: {
          kind: "block_mapping",
          inside: {
            kind: "block_node"
          }
        }
      });
      
      if(globalsMapping) {
        let globalPairs = globalsMapping.findAll({
          rule: {
            kind: "block_mapping_pair"
          }
        });
        
        for(let glob of globalPairs) {
          let keyNode = glob.find({
            rule: {
              kind: "flow_node",
              nthChild: 1,
              has: {
                kind: "plain_scalar",
                has: {
                  kind: "string_scalar",
                  pattern: "$IDENTIFIER"
                }
              }
            }
          });
          
          let identifier = keyNode?.getMatch("IDENTIFIER")?.text();
          if(!identifier) continue;
          
          let valueNode = glob.find({
            rule: {
              kind: "flow_node",
              nthChild: 2
            }
          });
          let value: any = valueNode?.text() || "readonly";
          if (value == 'true' || value == 'false') {
            value = value == 'true' ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          } else if (value === 'readonly' || value === 'writable' || value === 'off') {
            value = `"${value}"`;
          }
          globals[identifier] = value;
        }
      }
    }
    // detect globals end
    
    // start language options detection
    let languageOptions: Record<string, any> = {
      globals,
      parserOptions: {},
    };
    
    let parserOptionsSection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^parserOptions$"
            }
          }
        }
      }
    });
    
    if(parserOptionsSection) {
      let parserOptionsMapping = parserOptionsSection.find({
        rule: {
          kind: "block_mapping",
          inside: {
            kind: "block_node"
          }
        }
      });
      
      if(parserOptionsMapping) {
        let parserOptionPairs = parserOptionsMapping.findAll({
          rule: {
            kind: "block_mapping_pair"
          }
        });
        
        for(let option of parserOptionPairs) {
          let keyNode = option.find({
            rule: {
              kind: "flow_node",
              nthChild: 1,
              has: {
                kind: "plain_scalar",
                has: {
                  kind: "string_scalar",
                  pattern: "$IDENTIFIER"
                }
              }
            }
          });
          
          let identifier = keyNode?.getMatch("IDENTIFIER")?.text();
          if(!identifier) continue;
          
          let valueNode = option.find({
            rule: {
              kind: "flow_node",
              nthChild: 2
            }
          });
          let value: any = valueNode?.text() || "";
          if (value == 'true' || value == 'false') {
            value = value == 'true' ? true : false;
          } else if (!isNaN(value)) {
            value = parseInt(value);
          } else {
            value = `"${value}"`;
          }
          languageOptions.parserOptions[identifier] = value;
        }
      }
    }
    // end language options detection
    
    // start detecting env
    let envSection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^env$"
            }
          }
        }
      }
    });
    
    if(envSection) {
      let envMapping = envSection.find({
        rule: {
          kind: "block_mapping",
          inside: {
            kind: "block_node"
          }
        }
      });
      
      if(envMapping) {
        let envPairs = envMapping.findAll({
          rule: {
            kind: "block_mapping_pair"
          }
        });
        
        for (let env of envPairs) {
          let keyNode = env.find({
            rule: {
              kind: "flow_node",
              nthChild: 1,
              has: {
                kind: "plain_scalar",
                has: {
                  kind: "string_scalar",
                  pattern: "$IDENTIFIER"
                }
              }
            }
          });
          
          let identifier = keyNode?.getMatch("IDENTIFIER")?.text();
          if(!identifier) continue;
          
          let valueNode = env.find({
            rule: {
              kind: "flow_node",
              nthChild: 2
            }
          });
          let value: any = valueNode?.text() || false;
          if (value == 'true' || value == 'false') {
            value = value == 'true' ? true : false;
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
      }
    }
    sectorData.languageOptions = languageOptions;
    // end detecting env

    // start files detection
    let files = "";
    let filesSection = sector.find({
      rule: {
        kind: "block_mapping_pair",
        has: {
          kind: "flow_node",
          has: {
            kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^files$"
            }
          }
        }
      }
    });
    
    if(filesSection) {
      let filesNode = filesSection.find({
        rule: {
          any: [
            {
              kind: "block_sequence"
            },
            {
              kind: "flow_sequence"
            },
            {
              kind: "flow_node",
              nthChild: 2
            }
          ]
        }
      });
      if(filesNode) {
        let filesText = filesNode.text();
        files = convertYamlValueToJS(filesText);
      }
    }
    sectorData.files = files as string;
    // end files detection
    sectors.push(sectorData);
  }

  let newEslintConfig = `${imports.join("\n")}\nexport default defineConfig([${sectors.map(sector => {
    const rulesStr = Object.entries(sector.rules)
      .map(([key, value]) => `\n    ${key}: ${value}`)
      .join(',');
    const extendsStr = sector.extends.join(", ");
    let languageOptions = JSON.stringify(sector.languageOptions, null, 2);
    languageOptions = languageOptions.replace(
      /"(\.\.\.[^"]+)":\s*(?:["']'?"?"|\{\})?,?/g,
      "    $1,"
    );
    return `\n  {${sector.extends.length ? `\n    ...${extendsStr},` : ''}
    languageOptions: ${languageOptions},
    rules: {${rulesStr}
    }${sector.files ? `,\n    files: ${sector.files}` : ''}\n  }`;
  }).join(',')}
])`;

  const newSource = newEslintConfig;
  return newSource;
}

function convertYamlValueToJS(yamlValue: string): string {
  yamlValue = yamlValue.trim();
  
  // Handle block sequences (YAML arrays with -)
  if (yamlValue.includes('\n-') || yamlValue.startsWith('-')) {
    let lines = yamlValue.split('\n').map(l => l.trim()).filter(l => l);
    let items: any[] = [];
    let currentItem = '';
    let inObject = false;
    
    for (let line of lines) {
      if (line.startsWith('-')) {
        if (currentItem) {
          items.push(parseYamlValue(currentItem.trim()));
        }
        currentItem = line.substring(1).trim();
        inObject = currentItem.includes(':');
      } else if (line.includes(':')) {
        inObject = true;
        currentItem += '\n' + line;
      } else {
        currentItem += ' ' + line;
      }
    }
    if (currentItem) {
      items.push(parseYamlValue(currentItem.trim()));
    }
    
    return '[' + items.join(', ') + ']';
  }
  
  // Handle flow sequences [item1, item2]
  if (yamlValue.startsWith('[') && yamlValue.endsWith(']')) {
    return yamlValue;
  }
  
  // Handle objects
  if (yamlValue.includes('\n') && yamlValue.includes(':')) {
    return parseYamlObject(yamlValue);
  }
  
  return parseYamlValue(yamlValue);
}

function parseYamlValue(value: string): string {
  value = value.trim();
  
  // Handle objects in array items
  if (value.includes(':')) {
    return parseYamlObject(value);
  }
  
  // Handle strings
  if (value === 'true') return 'true';
  if (value === 'false') return 'false';
  if (value === 'null') return 'null';
  if (!isNaN(Number(value))) return value;
  
  // It's a string, add quotes
  if (value.startsWith('"') && value.endsWith('"')) return value;
  if (value.startsWith("'") && value.endsWith("'")) return `"${value.slice(1, -1)}"`;
  return `"${value}"`;
}

function parseYamlObject(yamlObj: string): string {
  let lines = yamlObj.split('\n').map(l => l.trim()).filter(l => l);
  let obj: Record<string, any> = {};
  
  for (let line of lines) {
    if (line.includes(':')) {
      let parts = line.split(':');
      let key = parts[0]?.trim();
      if(!key) continue;
      let valueParts = parts.slice(1);
      let value = valueParts.join(':').trim();
      
      if (value) {
        obj[key] = parseYamlValue(value);
      } else {
        obj[key] = '{}';
      }
    }
  }
  
  let entries = Object.entries(obj).map(([k, v]) => `"${k}": ${v}`).join(', ');
  return `{${entries}}`;
}

function handleSpecialRules(sector: SgNode<YAML>, sectorData: any) {
  // Handle no-unused-vars
  handleNoUnusedVars(sector, sectorData);
  
  // Handle no-sequences
  handleNoSequences(sector, sectorData);
  
  // Handle no-constructor-return
  handleNoConstructorReturn(sector, sectorData);
  
  // Handle no-useless-computed-key
  handleNoUselessComputedKey(sector, sectorData);
  
  // Handle camelcase
  handleCamelcase(sector, sectorData);
}

function handleNoUnusedVars(sector: SgNode<YAML>, sectorData: any) {
  let noUnusedVars = {
    type: "nothing",
    options: {} as Record<string, any>,
  }
  
  let rulesSection = sector.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^rules$"
          }
        }
      }
    }
  });
  
  if(!rulesSection) return;
  
  let noUnusedVarsRule = rulesSection.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
            has: {
              kind: "string_scalar",
              regex: "^no-unused-vars$"
            }
        }
      }
    }
  });
  
  if(noUnusedVarsRule) {
    // Check if it's an array (block_sequence)
    let sequenceRule = noUnusedVarsRule.find({
      rule: {
        kind: "block_sequence"
      }
    });
    
    if(sequenceRule) {
      let items = sequenceRule.findAll({
        rule: {
          kind: "block_sequence_item"
        }
      });
      
      if(items.length > 0) {
        let firstItem = items[0]?.find({
          rule: {
            kind: "flow_node"
          }
        });
        noUnusedVars.type = firstItem?.text() || "";
        
        // Get options from second item if it exists
        if(items.length > 1) {
          let optionsItem = items[1];
          if(optionsItem) {
            let optionPairs = optionsItem.findAll({
              rule: {
                kind: "block_mapping_pair"
              }
            });
            
            for(let pair of optionPairs) {
              let key = pair.find({
                rule: {
                  kind: "flow_node",
                  nthChild: 1
                }
              })?.text();
              let value = pair.find({
                rule: {
                  kind: "flow_node",
                  nthChild: 2
                }
              })?.text();
              
              if(!key || !value) continue;
              
              if (value == 'true') value = 'true';
              else if (value == 'false') value = 'false';
              else if (!isNaN(Number(value))) value = value;
              else value = `"${value}"`;
              noUnusedVars.options[key] = value;
            }
          }
        }
      }
    } else {
      // Simple value
      let valueNode = noUnusedVarsRule.find({
        rule: {
          kind: "flow_node",
          nthChild: 2
        }
      });
      noUnusedVars.type = valueNode?.text() || "";
    }
  }
  
  if(noUnusedVars.type !== 'nothing') {
    delete sectorData.rules['"no-unused-vars"'];
    if (Object.keys(noUnusedVars.options).length) {
      let optionsStr = Object.entries(noUnusedVars.options)
        .map(([k, v]) => `"${k}": ${v}`)
        .join(', ');
      sectorData.rules['"no-unused-vars"'] = `["${noUnusedVars.type}", {${optionsStr}}]`;
    } else {
      sectorData.rules['"no-unused-vars"'] = `["${noUnusedVars.type}"]`;
    }
  }
}

function handleNoSequences(sector: SgNode<YAML>, sectorData: any) {
  let noSequences = {
    type: "nothing",
    allowInParenthesesExists: false,
    allowInParentheses: false
  };
  
  let rulesSection = sector.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^rules$"
          }
        }
      }
    }
  });
  
  if(!rulesSection) return;
  
  let noSequencesRule = rulesSection.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^no-sequences$"
          }
        }
      }
    }
  });
  
  if(noSequencesRule) {
    let sequenceRule = noSequencesRule.find({
      rule: {
        kind: "block_sequence"
      }
    });
    
    if(sequenceRule) {
      let items = sequenceRule.findAll({
        rule: {
          kind: "block_sequence_item"
        }
      });
      
      if(items.length > 0) {
        let firstItem = items[0]?.find({
          rule: {
            kind: "flow_node"
          }
        });
        let typeText = firstItem?.text() || "";
        if(["error", "warn"].includes(typeText)) {
          noSequences.type = typeText;
          
          // Check for options
          if(items.length > 1) {
            let optionsItem = items[1];
            if(optionsItem) {
              let allowInParenthesesPair = optionsItem.find({
                rule: {
                  kind: "block_mapping_pair",
                  has: {
                    kind: "flow_node",
                    regex: "allowInParentheses"
                  }
                }
              });
              
              if(allowInParenthesesPair) {
                let value = allowInParenthesesPair.find({
                  rule: {
                    kind: "flow_node",
                    nthChild: 2
                  }
                })?.text();
                noSequences.allowInParentheses = value == "true" ? true : false;
                noSequences.allowInParenthesesExists = true;
              }
            }
          }
        }
      }
    } else {
      let valueNode = noSequencesRule.find({
        rule: {
          kind: "flow_node",
          nthChild: 2
        }
      });
      let typeText = valueNode?.text() || "";
      if(["error", "warn"].includes(typeText)) {
        noSequences.type = typeText;
      }
    }
  }
  
  if (noSequences.type != "nothing") {
    delete sectorData.rules['"no-sequences"'];
    if (typeof noSequences.allowInParentheses == 'boolean' && noSequences.allowInParenthesesExists == true) {
      sectorData.rules['"no-sequences"'] = `["${noSequences.type}", {"allowInParentheses": ${noSequences.allowInParentheses}}]`;
    } else {
      sectorData.rules['"no-sequences"'] = `["${noSequences.type}"]`;
    }
  }
}

function handleNoConstructorReturn(sector: SgNode<YAML>, sectorData: any) {
  let noConstructorReturn = "";
  
  let rulesSection = sector.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^rules$"
          }
        }
      }
    }
  });
  
  if(!rulesSection) return;
  
  let noConstructorReturnRule = rulesSection.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^no-constructor-return$"
          }
        }
      }
    }
  });
  
  if(noConstructorReturnRule) {
    let sequenceRule = noConstructorReturnRule.find({
      rule: {
        kind: "block_sequence"
      }
    });
    
    if(sequenceRule) {
      let firstItem = sequenceRule.find({
        rule: {
          kind: "flow_node",
          inside: {
            kind: "block_sequence_item"
          }
        }
      });
      noConstructorReturn = firstItem?.text() || "";
    } else {
      let valueNode = noConstructorReturnRule.find({
        rule: {
          kind: "flow_node",
          nthChild: 2
        }
      });
      noConstructorReturn = valueNode?.text() || "";
    }
  }
  
  if(noConstructorReturn) {
    delete sectorData.rules['"no-constructor-return"'];
    sectorData.rules['"no-constructor-return"'] = `["${noConstructorReturn}"]`;
  }
}

function handleNoUselessComputedKey(sector: SgNode<YAML>, sectorData: any) {
  let noUselessComputedKeys = {
    type: "nothing",
    options: {
      enforceForClassMembers: false
    } as Record<string, any>,
  }
  
  let rulesSection = sector.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^rules$"
          }
        }
      }
    }
  });
  
  if(!rulesSection) return;
  
  let noUselessComputedKeysRule = rulesSection.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^no-useless-computed-key$"
          }
        }
      }
    }
  });
  
  if(noUselessComputedKeysRule) {
    let sequenceRule = noUselessComputedKeysRule.find({
      rule: {
        kind: "block_sequence"
      }
    });
    
    if(sequenceRule) {
      let items = sequenceRule.findAll({
        rule: {
          kind: "block_sequence_item"
        }
      });
      
      if(items.length > 0) {
        let firstItem = items[0]?.find({
          rule: {
            kind: "flow_node"
          }
        });
        noUselessComputedKeys.type = firstItem?.text() || "";
        
        if(items.length > 1) {
          let optionsItem = items[1];
          if(optionsItem) {
            let enforcePair = optionsItem.find({
              rule: {
                kind: "block_mapping_pair",
                has: {
                  kind: "flow_node",
                  regex: "enforceForClassMembers"
                }
              }
            });
            
            if(enforcePair) {
              let value = enforcePair.find({
                rule: {
                  kind: "flow_node",
                  nthChild: 2
                }
              })?.text();
              noUselessComputedKeys.options.enforceForClassMembers = value == "true" ? true : false;
            }
          }
        }
      }
    } else {
      let valueNode = noUselessComputedKeysRule.find({
        rule: {
          kind: "flow_node",
          nthChild: 2
        }
      });
      noUselessComputedKeys.type = valueNode?.text() || "";
    }
  }
  
  if(noUselessComputedKeys.type != 'nothing') {
    delete sectorData.rules['"no-useless-computed-key"'];
    sectorData.rules['"no-useless-computed-key"'] = `["${noUselessComputedKeys.type}", {"enforceForClassMembers": ${noUselessComputedKeys.options.enforceForClassMembers}}]`;
  }
}

function handleCamelcase(sector: SgNode<YAML>, sectorData: any) {
  let camelcase = {
    type: "nothing",
    options: {} as Record<string, any>,
  }
  
  let rulesSection = sector.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^rules$"
          }
        }
      }
    }
  });
  
  if(!rulesSection) return;
  
  let camelcaseRule = rulesSection.find({
    rule: {
      kind: "block_mapping_pair",
      has: {
        kind: "flow_node",
        has: {
          kind: "plain_scalar",
          has: {
            kind: "string_scalar",
            regex: "^camelcase$"
          }
        }
      }
    }
  });
  
  if(camelcaseRule) {
    let sequenceRule = camelcaseRule.find({
      rule: {
        kind: "block_sequence"
      }
    });
    
    if(sequenceRule) {
      let items = sequenceRule.findAll({
        rule: {
          kind: "block_sequence_item"
        }
      });
      
      if(items.length > 0) {
        let firstItem = items[0]?.find({
          rule: {
            kind: "flow_node"
          }
        });
        camelcase.type = firstItem?.text() || "";
        
        if(items.length > 1) {
          let optionsItem = items[1];
          if(optionsItem) {
            let optionPairs = optionsItem.findAll({
              rule: {
                kind: "block_mapping_pair"
              }
            });
            
            for(let pair of optionPairs) {
              let key = pair.find({
                rule: {
                  kind: "flow_node",
                  nthChild: 1
                }
              })?.text();
              let value = pair.find({
                rule: {
                  kind: "flow_node",
                  nthChild: 2
                }
              })?.text();
              
              if(!key || !value) continue;
              
              if (value == 'true') value = 'true';
              else if (value == 'false') value = 'false';
              else if (!isNaN(Number(value))) value = value;
              else value = `"${value}"`;
              camelcase.options[key] = value;
            }
          }
        }
      }
    } else {
      let valueNode = camelcaseRule.find({
        rule: {
          kind: "flow_node",
          nthChild: 2
        }
      });
      camelcase.type = valueNode?.text() || "";
    }
  }
  
  if (camelcase.type != 'nothing') {
    delete sectorData.rules['"camelcase"'];
    let optionsStr = Object.entries(camelcase.options)
      .map(([k, v]) => `"${k}": ${v}`)
      .join(', ');
    sectorData.rules['"camelcase"'] = `["${camelcase.type}", {${optionsStr}}]`;
  }
}

export default transform;
