import path from 'node:path'

import { type SgRoot, parse } from 'codemod:ast-grep'
import type { SgNode } from 'codemod:ast-grep'
import type JSONLang from 'codemod:ast-grep/langs/json'
import { getState } from 'codemod:workflow'

import makeNewConfig from '../utils/make-new-config.ts'
import type { LanguageOptions, SectorData } from '../utils/make-new-config.ts'
import makePluginImport from '../utils/make-plugin-import.ts'

async function transform(root: SgRoot<JSONLang>): Promise<string | null> {
  const rootNode = root.root()
  const source = rootNode.text()
  // For JSON, we look for the root object and objects inside overrides array.
  const rulesSectorsRule = rootNode.findAll({
    rule: {
      any: [
        {
          kind: 'object',
          inside: {
            kind: 'document',
          },
        },
        {
          kind: 'object',
          inside: {
            kind: 'array',
            inside: {
              kind: 'pair',
              has: {
                kind: 'string',
                regex: '"overrides"',
              },
            },
          },
        },
      ],
    },
  })

  const imports: string[] = []

  const sectors: SectorData[] = []

  for (let sector of rulesSectorsRule) {
    const sectorData: SectorData = {
      rules: {} as Record<string, string>,
      extends: [] as string[], // Preserved extends exactly as they were
      languageOptions: {} as LanguageOptions,
      files: String(),
      excludedFiles: String(),
      plugins: [] as { key: string; identifier: string }[],
      requireJsdoc: {
        exists: false,
        settings: {},
      },
      extendsTodoComments: [] as string[], // TODO comments for extends
      linterOptions: undefined as Record<string, string> | undefined,
    }
    // remove sector overrides
    const overridesRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          regex: '"overrides"',
        },
      },
    })
    if (overridesRule) {
      const overrides = overridesRule?.text()
      let newSectorText = sector.text()
      // Remove the pair and adjacent comma(s) so JSON stays valid
      newSectorText = newSectorText.replace(overrides, '')
      newSectorText = newSectorText
        .replaceAll(/,\s*,/g, ',')
        .replaceAll(/,\s*([}\]])/g, '$1')
        .replace(/^\s*{\s*,/, '{')
      const newSectorRoot = parse('json', newSectorText)
      sector = newSectorRoot.root() as unknown as SgNode<JSONLang>
    }

    // start detecting parser
    // In flat config, parser must be an imported object, not a string
    // Map common parser packages to their import names
    const parserImportMap: Record<string, { importName: string; packageName: string }> = {
      '@typescript-eslint/parser': {
        importName: 'typescriptParser',
        packageName: '@typescript-eslint/parser',
      },
      '@babel/eslint-parser': { importName: 'babelParser', packageName: '@babel/eslint-parser' },
      'babel-eslint': { importName: 'babelEslint', packageName: 'babel-eslint' },
      'vue-eslint-parser': { importName: 'vueParser', packageName: 'vue-eslint-parser' },
      espree: { importName: 'espree', packageName: 'espree' },
      '@angular-eslint/template-parser': {
        importName: 'templateParser',
        packageName: '@angular-eslint/template-parser',
      },
      'svelte-eslint-parser': { importName: 'svelteParser', packageName: 'svelte-eslint-parser' },
      'jsonc-eslint-parser': { importName: 'jsoncParser', packageName: 'jsonc-eslint-parser' },
      'yaml-eslint-parser': { importName: 'yamlParser', packageName: 'yaml-eslint-parser' },
      '@graphql-eslint/eslint-plugin': {
        importName: 'graphqlParser',
        packageName: '@graphql-eslint/eslint-plugin',
      },
    }

    const parserPairRule = rootNode.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          regex: '"parser"',
        },
      },
    })
    let parser = ''
    if (parserPairRule) {
      // Find the value string (the second string that is not "parser")
      const parserValueRule = parserPairRule.find({
        rule: {
          kind: 'string',
          not: {
            regex: '"parser"',
          },
        },
      })
      if (parserValueRule) {
        let parserString = parserValueRule.text()
        // Remove quotes
        if (parserString.startsWith('"') && parserString.at(-1) === '"') {
          parserString = parserString.substring(1, parserString.length - 1)
        }

        const parserInfo = parserImportMap[parserString]
        if (parserInfo) {
          // Add import for the parser
          const parserImport = `import ${parserInfo.importName} from "${parserInfo.packageName}";`
          if (!imports.includes(parserImport)) {
            imports.push(parserImport)
          }
          parser = parserInfo.importName
        } else {
          // Unknown parser - generate a reasonable import name
          const importName = parserString
            .replace(/^@/, '')
            .replaceAll(/[/-]([a-z])/g, (_, letter: string) => letter.toUpperCase())
            .replace(/^([a-z])/, (_, letter: string) => letter.toUpperCase())
            .replaceAll(/[^a-zA-Z0-9]/g, '')
          const parserImport = `import ${importName} from "${parserString}";`
          if (!imports.includes(parserImport)) {
            imports.push(parserImport)
          }
          parser = importName
        }
      }
    }
    // end detecting parser

    // start detecting rules
    const rulesRule = sector.findAll({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          nthChild: 1,
          pattern: '$IDENTIFIER',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              regex: '"rules"',
            },
          },
        },
      },
    })
    for (const rule of rulesRule) {
      const identifer = rule.getMatch('IDENTIFIER')?.text()
      if (!identifer) {
        continue
      }
      const value = rule.text().trim().replace(`${identifer}:`, '').trim().replace(/,\s*$/, '')
      sectorData.rules[identifer] = value
    }
    // end detecting rules

    // start jsDocs section
    let jsDocs = {
      type: 'nothing',
      options: {},
    }
    const requireJsdocRule = sector.findAll({
      rule: {
        kind: 'pair',
        pattern: '$PAIR',
        has: {
          kind: 'string',
          pattern: '"require-jsdoc"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    for (const jsdoc of requireJsdocRule) {
      const identifier = jsdoc.getMatch('IDENTIFIER')?.text()
      if (identifier === '"rules"') {
        const pair = jsdoc?.getMatch('PAIR')?.text().trim().replace('"require-jsdoc":', '').trim()
        if (pair?.[0] === '"' && pair.at(-1) === '"') {
          jsDocs.type = pair.substring(1, pair.length - 1)
          continue
        }
        const jsdocTypeRule = jsdoc.find({
          rule: {
            kind: 'string',
            pattern: '$TYPE',
            inside: {
              kind: 'array',
            },
          },
        })
        const jsdocOptionsRule = jsdoc.findAll({
          rule: {
            kind: 'pair',
            pattern: '$PAIR',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
            inside: {
              kind: 'object',
              inside: {
                kind: 'pair',
                has: {
                  kind: 'string',
                  pattern: '$SETTING_IDENTIFIER',
                },
                inside: {
                  kind: 'object',
                  inside: {
                    kind: 'array',
                  },
                },
              },
            },
          },
        })
        if (jsdocTypeRule) {
          let jsdocType = jsdocTypeRule.getMatch('TYPE')?.text() ?? ''
          // Remove quotes from jsdocType
          if (jsdocType.startsWith('"') && jsdocType.at(-1) === '"') {
            jsdocType = jsdocType.substring(1, jsdocType.length - 1)
          }
          const jsdocOptions: Record<string, string> = {}
          if (jsdocOptionsRule.length) {
            const optionsIdentifier = jsdocOptionsRule[0]?.getMatch('SETTING_IDENTIFIER')?.text()
            if (optionsIdentifier === '"require"') {
              for (const option of jsdocOptionsRule) {
                const identifier = option.getMatch('IDENTIFIER')?.text()
                if (identifier) {
                  let value = option.text().replace(`${identifier}:`, '')
                  value = value.trim()
                  jsdocOptions[identifier] = value
                }
              }
            }
          }
          jsDocs = { type: jsdocType, options: jsdocOptions }
        }
      }
    }
    delete sectorData.rules['"require-jsdoc"']
    delete sectorData.rules['"valid-jsdoc"']
    if ((jsDocs.type !== 'nothing' && jsDocs.type !== 'off') || getState<boolean>('doesJsDocCommentExist') === true) {
      sectorData.requireJsdoc.exists = true
      sectorData.requireJsdoc.settings = jsDocs.options
      imports.push('import { jsdoc } from "eslint-plugin-jsdoc";')
    }
    // end jsDocs section
    // start no-constructor-return and no-sequences section
    let noConstructorReturn = ''
    const noConstructorReturnRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          pattern: '"no-constructor-return"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    if (noConstructorReturnRule) {
      const isArrayRule = noConstructorReturnRule.findAll({
        rule: {
          kind: 'string',
          pattern: '$TYPE',
          inside: {
            kind: 'array',
          },
        },
      })
      if (isArrayRule.length) {
        const typeText = isArrayRule[0]?.getMatch('TYPE')?.text() ?? ''
        // Remove quotes
        if (typeText.startsWith('"') && typeText.at(-1) === '"') {
          noConstructorReturn = typeText.substring(1, typeText.length - 1)
        }
      } else {
        let typeRule = noConstructorReturnRule.findAll({
          rule: {
            kind: 'string',
            pattern: '$TYPE',
          },
        })
        typeRule = typeRule.filter((rule) => {
          const text = rule.getMatch('TYPE')?.text() ?? ''
          return text !== '"no-constructor-return"'
        })
        if (typeRule.length) {
          const typeText = typeRule[0]?.getMatch('TYPE')?.text() ?? ''
          if (typeText.startsWith('"') && typeText.at(-1) === '"') {
            noConstructorReturn = typeText.substring(1, typeText.length - 1)
          }
        }
      }
    }
    if (noConstructorReturn) {
      delete sectorData.rules['"no-constructor-return"']
      sectorData.rules['"no-constructor-return"'] = `["${noConstructorReturn}"]`
    }

    const noSequences = {
      type: 'nothing',
      allowInParenthesesExists: false,
      allowInParentheses: false,
    }
    const noSequencesRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          pattern: '"no-sequences"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    if (noSequencesRule) {
      const isArrayRule = noSequencesRule.findAll({
        rule: {
          kind: 'string',
          pattern: '$TYPE',
          inside: {
            kind: 'array',
            pattern: '$ARRAY',
          },
        },
      })
      if (isArrayRule.length) {
        let array: SgNode<JSONLang> | undefined
        const noSequencesRuleTypeObject = isArrayRule.filter((rule) => {
          let noSequencesRuleType = rule.getMatch('TYPE')?.text() ?? ''
          // Remove quotes
          if (noSequencesRuleType.startsWith('"') && noSequencesRuleType.at(-1) === '"') {
            noSequencesRuleType = noSequencesRuleType.substring(1, noSequencesRuleType.length - 1)
          }
          const arrayRule = rule.getMatch('ARRAY')
          if (arrayRule) {
            array = arrayRule
          }
          return !!['error', 'warn'].includes(noSequencesRuleType)
        })
        if (noSequencesRuleTypeObject.length) {
          let noSequencesRuleType = noSequencesRuleTypeObject[0]?.getMatch('TYPE')?.text() ?? ''
          // Remove quotes
          if (noSequencesRuleType.startsWith('"') && noSequencesRuleType.at(-1) === '"') {
            noSequencesRuleType = noSequencesRuleType.substring(1, noSequencesRuleType.length - 1)
          }
          noSequences.type = noSequencesRuleType
          const allowInParenthesesOptionRule = array?.find({
            rule: {
              kind: 'string',
              regex: '"allowInParentheses"',
              inside: {
                kind: 'pair',
                pattern: '$PAIR',
                inside: {
                  kind: 'object',
                },
              },
            },
          })
          if (allowInParenthesesOptionRule) {
            const pairNode = allowInParenthesesOptionRule.parent()?.parent()
            let allowInParenthesesOption = pairNode?.text() ?? ''
            allowInParenthesesOption = allowInParenthesesOption.trim().replace('"allowInParentheses":', '').trim()
            noSequences.allowInParentheses = allowInParenthesesOption === 'true'
            noSequences.allowInParenthesesExists = true
          }
        }
      } else {
        let typeRule = noSequencesRule.findAll({
          rule: {
            kind: 'string',
            pattern: '$TYPE',
          },
        })
        typeRule = typeRule.filter((rule) => {
          const text = rule.getMatch('TYPE')?.text() ?? ''
          return text !== '"no-sequences"'
        })
        if (typeRule.length) {
          const typeText = typeRule[0]?.getMatch('TYPE')?.text() ?? ''
          if (typeText.startsWith('"') && typeText.at(-1) === '"') {
            noSequences.type = typeText.substring(1, typeText.length - 1)
          }
        }
      }
    }
    if (noSequences.type !== 'nothing') {
      delete sectorData.rules['"no-sequences"']
      if (typeof noSequences.allowInParentheses === 'boolean' && noSequences.allowInParenthesesExists === true) {
        sectorData.rules['"no-sequences"'] =
          `["${noSequences.type}", {"allowInParentheses": ${noSequences.allowInParentheses}}]`
      } else {
        sectorData.rules['"no-sequences"'] = `["${noSequences.type}"]`
      }
    }

    // Extract extends from the sector - preserve exactly as they were (all entries)
    const extendsRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          regex: '"extends"',
        },
      },
    })

    const preservedExtends: string[] = []

    if (extendsRule) {
      // Get the value of the extends pair (array or string)
      const extendsValueArray = extendsRule.find({
        rule: {
          kind: 'array',
          has: {
            kind: 'string',
          },
        },
      })
      if (extendsValueArray) {
        // Multiple extends: collect every string in the array (direct children only)
        const extendStringNodes = extendsValueArray.findAll({
          rule: {
            kind: 'string',
            pattern: '$STRING',
          },
        })
        for (const extendNode of extendStringNodes) {
          let extendText = (extendNode.getMatch('STRING')?.text() ?? extendNode.text()) || ''
          // Remove quotes from JSON string
          if (extendText.startsWith('"') && extendText.at(-1) === '"') {
            extendText = extendText.substring(1, extendText.length - 1)
          }
          preservedExtends.push(extendText)
        }
      } else {
        // Single string extends
        const extendsExecute = extendsRule.find({
          rule: {
            kind: 'string',
            not: {
              regex: '"extends"',
            },
          },
        })
        let extendText = extendsExecute?.text() ?? ''
        if (extendText.startsWith('"') && extendText.at(-1) === '"') {
          extendText = extendText.substring(1, extendText.length - 1)
        }
        if (extendText) {
          preservedExtends.push(extendText)
        }
      }
    }

    // Store extends exactly as they were
    sectorData.extends = preservedExtends

    // Extract plugins from the sector - preserve exactly as they were
    const pluginsRule = sector.find({
      rule: {
        kind: 'pair',
        inside: {
          kind: 'object',
          any: [
            {
              nthChild: 1,
            },
            {
              inside: {
                kind: 'array',
                inside: {
                  kind: 'pair',
                  has: {
                    kind: 'string',
                    nthChild: 1,
                    regex: '"overrides"',
                  },
                },
              },
            },
          ],
        },
        has: {
          kind: 'string',
          regex: '"plugins"',
          nthChild: 1,
        },
      },
    })

    if (pluginsRule) {
      // Check if plugins is an object or array
      const pluginsObject = pluginsRule.find({
        rule: {
          kind: 'object',
        },
      })

      if (pluginsObject) {
        // Extract all plugin pairs from the object
        const pluginPairs = pluginsObject.findAll({
          rule: {
            kind: 'pair',
            pattern: '$PAIR',
            has: {
              kind: 'string',
              nthChild: 1,
              pattern: '$PLUGIN_NAME',
            },
          },
        })

        for (const pluginPair of pluginPairs) {
          let pluginName = pluginPair.getMatch('PLUGIN_NAME')?.text() ?? ''
          // Remove quotes if present
          if (pluginName.startsWith('"') && pluginName.at(-1) === '"') {
            pluginName = pluginName.substring(1, pluginName.length - 1)
          }

          // Get the plugin value (could be a string, identifier, or require call)
          let pluginValue = pluginPair.text().trim()
          // Remove the plugin name and colon
          pluginValue = pluginValue.replace(new RegExp(`^"${pluginName}":\\s*`), '').trim()
          // Remove trailing comma if present
          pluginValue = pluginValue.replace(/,\s*$/, '')

          // Preserve the plugin exactly as it was
          const pluginImport = makePluginImport(pluginName)
          imports.push(`import ${pluginImport.identifier} from "${pluginImport.packageName}";`)
          sectorData.plugins?.push({ key: pluginName, identifier: pluginImport.identifier })
        }
      } else {
        // Plugins might be an array
        const pluginsArray = pluginsRule.find({
          rule: {
            kind: 'array',
          },
        })

        if (pluginsArray) {
          const pluginStrings = pluginsArray.findAll({
            rule: {
              kind: 'string',
              pattern: '$PLUGIN',
            },
          })

          for (const pluginString of pluginStrings) {
            let pluginText = pluginString.getMatch('PLUGIN')?.text() ?? ''
            // Remove quotes from JSON string
            if (pluginText.startsWith('"') && pluginText.at(-1) === '"') {
              pluginText = pluginText.substring(1, pluginText.length - 1)
            }
            // For array plugins, use the plugin name as both key and value
            const pluginImport = makePluginImport(pluginText)
            imports.push(`import ${pluginImport.identifier} from "${pluginImport.packageName}";`)
            sectorData.plugins?.push({ key: pluginText, identifier: pluginImport.identifier })
          }
        }
      }
    }
    // ============================================
    // END COMPREHENSIVE EXTENDS MIGRATION
    // ============================================
    // start execute no-unused-vars
    const noUnusedVars = {
      type: 'nothing',
      options: {
        caughtErrors: 'none',
      } as Record<string, string | number | boolean>,
    }
    const noUnusedVarsRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          pattern: '"no-unused-vars"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    if (noUnusedVarsRule) {
      const isArrayRule = noUnusedVarsRule.findAll({
        rule: {
          kind: 'string',
          pattern: '$TYPE',
          inside: {
            kind: 'array',
          },
        },
      })
      if (isArrayRule.length) {
        const typeText = isArrayRule[0]?.getMatch('TYPE')?.text() ?? ''
        if (typeText.startsWith('"') && typeText.at(-1) === '"') {
          noUnusedVars.type = typeText.substring(1, typeText.length - 1)
        }
        const optionsRule = noUnusedVarsRule.findAll({
          rule: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
            inside: {
              kind: 'object',
              inside: {
                kind: 'array',
              },
            },
          },
        })
        for (const option of optionsRule) {
          let identifier = option.getMatch('IDENTIFIER')?.text()
          if (!identifier) {
            continue
          }
          let value: string | number | boolean = option
            .text()
            .trim()
            .replace(`${identifier}:`, '')
            .trim()
            .replace(/,\s*$/, '')
          if (value === 'true' || value === 'false') {
            value = value === 'true'
          } else if (!Number.isNaN(Number.parseInt(value))) {
            value = Number.parseInt(value)
          }
          // Remove quotes from identifier
          if (identifier.startsWith('"') && identifier.at(-1) === '"') {
            identifier = identifier.substring(1, identifier.length - 1)
          }
          noUnusedVars.options[identifier] = value
        }
      } else {
        let typeRule = noUnusedVarsRule.findAll({
          rule: {
            kind: 'string',
            pattern: '$TYPE',
          },
        })
        typeRule = typeRule.filter((rule) => {
          const text = rule.getMatch('TYPE')?.text() ?? ''
          return text !== '"no-unused-vars"'
        })
        if (typeRule.length) {
          const typeText = typeRule[0]?.getMatch('TYPE')?.text() ?? ''
          if (typeText.startsWith('"') && typeText.at(-1) === '"') {
            noUnusedVars.type = typeText.substring(1, typeText.length - 1)
          }
        }
      }
    }
    if (noUnusedVars.type !== 'nothing') {
      delete sectorData.rules['"no-unused-vars"']
      if (Object.keys(noUnusedVars.options).length) {
        sectorData.rules['"no-unused-vars"'] = `["${noUnusedVars.type}", ${JSON.stringify(noUnusedVars.options)}]`
      } else {
        sectorData.rules['"no-unused-vars"'] = `["${noUnusedVars.type}"]`
      }
    }
    // end execute no-unused-vars
    // start no-useless-computed-key
    const noUselessComputedKeys = {
      type: 'nothing',
      options: {
        enforceForClassMembers: false,
      } as Record<string, string | number | boolean>,
    }
    const noUselessComputedVarsRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          pattern: '"no-useless-computed-key"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    if (noUselessComputedVarsRule) {
      const isArrayRule = noUselessComputedVarsRule.findAll({
        rule: {
          kind: 'string',
          pattern: '$TYPE',
          inside: {
            kind: 'array',
          },
        },
      })
      if (isArrayRule.length) {
        const typeText = isArrayRule[0]?.getMatch('TYPE')?.text() ?? ''
        if (typeText.startsWith('"') && typeText.at(-1) === '"') {
          noUselessComputedKeys.type = typeText.substring(1, typeText.length - 1)
        }
        const optionsRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
            inside: {
              kind: 'object',
              inside: {
                kind: 'array',
              },
            },
          },
        })
        for (const option of optionsRule) {
          let identifier = option.getMatch('IDENTIFIER')?.text()
          if (!identifier) {
            continue
          }
          const value = option.text().trim().replace(`${identifier}:`, '').trim().replace(/,\s*$/, '')
          // Remove quotes from identifier
          if (identifier.startsWith('"') && identifier.at(-1) === '"') {
            identifier = identifier.substring(1, identifier.length - 1)
          }
          noUselessComputedKeys.options[identifier] = value
        }
      } else {
        let typeRule = noUselessComputedVarsRule.findAll({
          rule: {
            kind: 'string',
            pattern: '$TYPE',
          },
        })
        typeRule = typeRule.filter((rule) => {
          const text = rule.getMatch('TYPE')?.text() ?? ''
          return text !== '"no-useless-computed-key"'
        })
        if (typeRule.length) {
          const typeText = typeRule[0]?.getMatch('TYPE')?.text() ?? ''
          if (typeText.startsWith('"') && typeText.at(-1) === '"') {
            noUselessComputedKeys.type = typeText.substring(1, typeText.length - 1)
          }
        }
      }
    }
    if (noUselessComputedKeys.type !== 'nothing') {
      delete sectorData.rules['"no-useless-computed-key"']
      sectorData.rules['"no-useless-computed-key"'] =
        `["${noUselessComputedKeys.type}", {enforceForClassMembers: ${noUselessComputedKeys.options.enforceForClassMembers}}]`
    }
    // end no-useless-computed-key
    // start camelcase
    const camelcase = {
      type: 'nothing',
      options: {} as Record<string, string | number | boolean>,
    }
    const camelcaseRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          pattern: '"camelcase"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    if (camelcaseRule) {
      const isArrayRule = camelcaseRule.findAll({
        rule: {
          kind: 'string',
          pattern: '$TYPE',
          inside: {
            kind: 'array',
          },
        },
      })
      if (isArrayRule.length) {
        const typeText = isArrayRule[0]?.getMatch('TYPE')?.text() ?? ''
        if (typeText.startsWith('"') && typeText.at(-1) === '"') {
          camelcase.type = typeText.substring(1, typeText.length - 1)
        }
        const optionsRule = camelcaseRule.findAll({
          rule: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
            inside: {
              kind: 'object',
              inside: {
                kind: 'array',
              },
            },
          },
        })
        for (const option of optionsRule) {
          let identifier = option.getMatch('IDENTIFIER')?.text()
          if (!identifier) {
            continue
          }
          let value: string | number | boolean = option
            .text()
            .trim()
            .replace(`${identifier}:`, '')
            .trim()
            .replace(/,\s*$/, '')
          if (value === 'true' || value === 'false') {
            value = value === 'true'
          } else if (!Number.isNaN(Number.parseInt(value))) {
            value = Number.parseInt(value)
          }
          // Remove quotes from identifier
          if (identifier.startsWith('"') && identifier.at(-1) === '"') {
            identifier = identifier.substring(1, identifier.length - 1)
          }
          if (identifier === 'allow') {
            const isUsingArray = option.find({
              rule: {
                kind: 'array',
                pattern: '[$$$ITEMS]',
                inside: {
                  kind: 'pair',
                },
              },
            })
            const items = isUsingArray?.getMultipleMatches('ITEMS')
            if (
              !items?.filter((item) => {
                const text = item.text()
                return !text.startsWith('"') && text !== ','
              }).length
            ) {
              camelcase.options[identifier] = value
            }
          } else {
            camelcase.options[identifier] = value
          }
        }
      } else {
        let typeRule = camelcaseRule.findAll({
          rule: {
            kind: 'string',
            pattern: '$TYPE',
          },
        })
        typeRule = typeRule.filter((rule) => {
          const text = rule.getMatch('TYPE')?.text() ?? ''
          return text !== '"camelcase"'
        })
        if (typeRule.length) {
          const typeText = typeRule[0]?.getMatch('TYPE')?.text() ?? ''
          if (typeText.startsWith('"') && typeText.at(-1) === '"') {
            camelcase.type = typeText.substring(1, typeText.length - 1)
          }
        }
      }
    }
    if (camelcase.type !== 'nothing') {
      delete sectorData.rules['"camelcase"']
      sectorData.rules['"camelcase"'] = `["${camelcase.type}", ${JSON.stringify(camelcase.options)}]`
    }
    // end camelcase

    // start detecting no-restricted-imports
    const noRestrictedImportsRule = sector.findAll({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          pattern: '"no-restricted-imports"',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              pattern: '$IDENTIFIER',
            },
          },
        },
      },
    })
    for (const noRestrictedImports of noRestrictedImportsRule) {
      const paths = noRestrictedImports.findAll({
        rule: {
          kind: 'object',
          has: {
            kind: 'pair',
            pattern: '$PAIR',
            has: {
              kind: 'string',
              regex: '"name"',
            },
          },
          inside: {
            kind: 'array',
            inside: {
              kind: 'pair',
              has: {
                kind: 'string',
                regex: '"paths"',
              },
              inside: {
                kind: 'object',
                inside: {
                  kind: 'array',
                  has: {
                    kind: 'string',
                    pattern: '$TYPE',
                  },
                },
              },
            },
          },
        },
      })
      if (paths.length) {
        let noRestrictedImportsType = paths[0]?.getMatch('TYPE')?.text()
        if (noRestrictedImportsType?.[0] === '"' && noRestrictedImportsType.at(-1) === '"') {
          noRestrictedImportsType = noRestrictedImportsType.substring(1, noRestrictedImportsType.length - 1)
        }
        let finalPaths: { name: string; content: string }[] = []
        for (const [_index, path] of paths.entries()) {
          const pair = path.getMatch('PAIR')
          const nameRule = pair?.find({
            rule: {
              kind: 'string',
              not: {
                regex: '"name"',
              },
              pattern: '$NAME',
            },
          })
          if (nameRule) {
            const name = nameRule.getMatch('NAME')?.text()
            if (!name) {
              continue
            }
            finalPaths.push({
              name,
              content: path.text(),
            })
          }
        }
        const pathsByName = new Map<string, { name: string; content: string }>()
        for (const path of finalPaths) {
          pathsByName.set(path.name, path)
        }
        finalPaths = [...pathsByName.values()]
        delete sectorData.rules['"no-restricted-imports"']
        let pairs = noRestrictedImports.findAll({
          rule: {
            kind: 'pair',
            inside: {
              kind: 'object',
              inside: {
                kind: 'array',
                inside: {
                  kind: 'pair',
                  has: {
                    kind: 'string',
                    regex: '"no-restricted-imports"',
                  },
                },
              },
            },
          },
        })
        pairs = pairs.filter((pair) => {
          const pairText = pair.text().trim().replaceAll(' ', '')
          if (pairText.startsWith('"paths":')) {
            return false
          }
          return true
        })
        sectorData.rules['"no-restricted-imports"'] = `["${noRestrictedImportsType}", {paths: ${finalPaths.map(
          (path) => path.content,
        )}, ${pairs.map((pair) => `${pair.text()},`)}}]`
      }
    }
    // end detecting no-restricted-imports

    // detect globals start
    const globals: Record<string, string | number | boolean> = {}
    const detectGlobalsRule = sector.findAll({
      rule: {
        kind: 'pair',
        pattern: '$PAIR',
        has: {
          kind: 'string',
          nthChild: 1,
          pattern: '$IDENTIFIER',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              regex: '"globals"',
            },
          },
        },
      },
    })
    for (const glob of detectGlobalsRule) {
      let identifier = glob.getMatch('IDENTIFIER')?.text()
      if (!identifier) {
        continue
      }
      let value: string | number | boolean = glob
        .text()
        .trim()
        .replace(`${identifier}:`, '')
        .trim()
        .replace(/,\s*$/, '')
      if (value === 'true' || value === 'false') {
        value = value === 'true'
      } else if (!Number.isNaN(Number.parseInt(value))) {
        value = Number.parseInt(value)
      }
      if (identifier.startsWith('"') && identifier.at(-1) === '"') {
        identifier = identifier.slice(1, identifier.length - 1)
      }
      globals[identifier] = value
    }
    // detect globals end
    // start language options detection start

    const languageOptions: LanguageOptions = {
      globals,
      parserOptions: {},
    }
    const detectParserOptions = sector.findAll({
      rule: {
        kind: 'pair',
        pattern: '$PAIR',
        has: {
          kind: 'string',
          nthChild: 1,
          pattern: '$IDENTIFIER',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              regex: '"parserOptions"',
            },
          },
        },
      },
    })
    for (const option of detectParserOptions) {
      let identifier = option.getMatch('IDENTIFIER')?.text()
      if (!identifier) {
        continue
      }
      let value: string | number | boolean = option
        .text()
        .trim()
        .replace(`${identifier}:`, '')
        .trim()
        .replace(/,\s*$/, '')
      if (value === 'true' || value === 'false') {
        value = value === 'true'
      } else if (!Number.isNaN(Number.parseInt(value))) {
        value = Number.parseInt(value)
      }
      // Remove quotes from identifier
      if (identifier.startsWith('"') && identifier.at(-1) === '"') {
        identifier = identifier.substring(1, identifier.length - 1)
      }
      languageOptions[identifier] = value
    }
    // end language options detection
    // start detecting env
    const detectingEnvRule = sector.findAll({
      rule: {
        kind: 'pair',
        pattern: '$PAIR',
        has: {
          kind: 'string',
          nthChild: 1,
          pattern: '$IDENTIFIER',
        },
        inside: {
          kind: 'object',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              regex: '"env"',
            },
          },
        },
      },
    })
    for (const env of detectingEnvRule) {
      let identifier = env.getMatch('IDENTIFIER')?.text()
      if (!identifier) {
        continue
      }
      let value: string | number | boolean = env.text().trim().replace(`${identifier}:`, '').trim().replace(/,\s*$/, '')
      if (value === 'true' || value === 'false') {
        value = value === 'true'
      } else if (!Number.isNaN(Number.parseInt(value))) {
        value = Number.parseInt(value)
      }
      // Remove quotes from identifier
      if (identifier.startsWith('"') && identifier.at(-1) === '"') {
        identifier = identifier.substring(1, identifier.length - 1)
      }
      if (value === true) {
        if (!imports.includes(`import globals from "globals";`)) {
          imports.push(`import globals from "globals";`)
        }
        languageOptions.globals[`...globals.${identifier}`] = ''
      } else {
        languageOptions.globals[identifier] = value
      }
    }
    if (parser) {
      languageOptions.parser = parser
    }
    sectorData.languageOptions = languageOptions
    // end detecting env

    // start files detection
    const filesValueDetection = sector.findAll({
      rule: {
        any: [
          {
            kind: 'string',
            inside: {
              kind: 'array',
              inside: {
                kind: 'pair',
                has: {
                  kind: 'string',
                  nthChild: 1,
                  has: {
                    kind: 'string_content',
                    regex: '^files$',
                  },
                },
              },
            },
          },
          {
            kind: 'string',
            nthChild: 2,
            inside: {
              kind: 'pair',
              has: {
                kind: 'string',
                nthChild: 1,
                has: {
                  kind: 'string_content',
                  regex: '^files$',
                },
              },
            },
          },
        ],
      },
    })
    if (filesValueDetection.length) {
      sectorData.files = `[${filesValueDetection
        .map((value) => value.text())
        .filter((value) => value !== '')
        .join(', ')}]`
    } else {
      sectorData.files = '[]'
    }
    // end files detection

    // start excludedFiles detection (flat config: ignores)
    const excludedFilesValueDetection = sector.findAll({
      rule: {
        any: [
          {
            kind: 'string',
            inside: {
              kind: 'array',
              inside: {
                kind: 'pair',
                has: {
                  kind: 'string',
                  nthChild: 1,
                  has: {
                    kind: 'string_content',
                    regex: '^excludedFiles$',
                  },
                },
              },
            },
          },
          {
            kind: 'string',
            nthChild: 2,
            inside: {
              kind: 'pair',
              has: {
                kind: 'string',
                nthChild: 1,
                has: {
                  kind: 'string_content',
                  regex: '^excludedFiles$',
                },
              },
            },
          },
        ],
      },
    })
    if (excludedFilesValueDetection.length) {
      sectorData.excludedFiles = `[${excludedFilesValueDetection
        .map((value) => value.text())
        .filter((value) => value !== '')
        .join(', ')}]`
    } else {
      sectorData.excludedFiles = '[]'
    }
    // end excludedFiles detection

    // start linterOptions detection (noInlineConfig, reportUnusedDisableDirectives)
    const linterOptions: Record<string, string> = {}

    const noInlineConfigRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          regex: '^"noInlineConfig"$',
        },
        inside: {
          kind: 'object',
        },
      },
    })
    if (noInlineConfigRule) {
      let pairText = noInlineConfigRule.text().trim()
      pairText = pairText
        .replace(/^"noInlineConfig"\s*:\s*/, '')
        .replace(/,\s*$/, '')
        .trim()
      if (pairText === 'true' || pairText === 'false') {
        linterOptions.noInlineConfig = pairText
      }
    }

    const reportUnusedDisableDirectivesRule = sector.find({
      rule: {
        kind: 'pair',
        has: {
          kind: 'string',
          regex: '^"reportUnusedDisableDirectives"$',
        },
        inside: {
          kind: 'object',
        },
      },
    })
    if (reportUnusedDisableDirectivesRule) {
      let pairText = reportUnusedDisableDirectivesRule.text().trim()
      pairText = pairText
        .replace(/^"reportUnusedDisableDirectives"\s*:\s*/, '')
        .replace(/,\s*$/, '')
        .trim()
      if (pairText === 'true') {
        // In eslintrc, `true` was equivalent to `"warn"` in flat config
        linterOptions.reportUnusedDisableDirectives = '"warn"'
      } else if (pairText === 'false') {
        linterOptions.reportUnusedDisableDirectives = '"off"'
      } else if (pairText) {
        // Preserve any quoted severity string ("error", "warn", "off") as-is
        linterOptions.reportUnusedDisableDirectives = pairText
      }
    }

    if (Object.keys(linterOptions).length > 0) {
      sectorData.linterOptions = linterOptions
    }
    // end linterOptions detection

    // start execution ignorePatterns: {"ignorePatterns": ["test", "m"]}
    const ignorePatternsRule = sector.findAll({
      rule: {
        kind: 'string',
        inside: {
          kind: 'array',
          inside: {
            kind: 'pair',
            has: {
              kind: 'string',
              has: {
                kind: 'string_content',
                regex: 'ignorePatterns',
              },
            },
          },
        },
      },
    })
    if (ignorePatternsRule.length) {
      sectorData.ignorePatterns = ignorePatternsRule.map((rule) => rule.text().trim())
    }
    // end execution "ignorePatterns": {ignorePatterns: ["test", "m"]}

    sectors.push(sectorData)
  }

  const directory = path.dirname(root.filename()).replaceAll(/[/\\]/g, '-')
  const newSource = makeNewConfig(sectors, imports, directory)
  if (newSource === source) {
    return null
  }
  return newSource
}

export default transform
