import { type SgRoot, parse } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import type { SgNode } from "codemod:ast-grep";
import { getState } from "codemod:workflow";
import makeNewConfig from "../utils/make-new-config.ts";
import type { LanguageOptions, SectorData } from "../utils/make-new-config.ts";
import path from "path";
import makePluginImport from "../utils/make-plugin-import.ts";

/** Top-level `const x = …` initializer text for same-file spread / identifier resolution in `rules`. */
function collectBindingsFromProgram(rootNode: SgNode<JS>): Map<string, string> {
  const bindings = new Map<string, string>();
  const declarators = rootNode.findAll({
    rule: {
      kind: "variable_declarator",
    },
  });
  for (const decl of declarators) {
    const declText = decl.text().trim();
    const sp = splitAtFirstTopLevelDelimiter(declText, "=");
    if (!sp) continue;
    const name = sp.before.trim();
    const simple = /^([a-zA-Z_$][\w$]*)/.exec(name);
    if (!simple?.[1]) continue;
    bindings.set(simple[1], sp.after.trim());
  }
  return bindings;
}

function findRulesPair(sector: SgNode<JS>): SgNode<JS> | null {
  return (
    sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "property_identifier",
          regex: "^rules$",
        },
      },
    }) ??
    sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "string",
          has: {
            kind: "string_fragment",
            regex: "^rules$",
          },
        },
      },
    })
  );
}

function normalizePairKey(rawKey: string): string {
  const k = rawKey.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    return k.slice(1, -1);
  }
  return k;
}

/** Split at first delimiter (`:` for pairs, `=` for declarators) outside strings and nested `()[]{}`. */
function splitAtFirstTopLevelDelimiter(
  src: string,
  delimiterChar: string
): { before: string; after: string } | null {
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let inString: "'" | '"' | null = null;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inString) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = c as "'" | '"';
      continue;
    }

    if (c === "{") braceDepth++;
    else if (c === "}") braceDepth--;
    else if (c === "[") bracketDepth++;
    else if (c === "]") bracketDepth--;
    else if (c === "(") parenDepth++;
    else if (c === ")") parenDepth--;

    const depth = braceDepth + bracketDepth + parenDepth;
    if (c === delimiterChar && depth === 0) {
      return {
        before: src.slice(0, i).trim(),
        after: src.slice(i + 1).trim(),
      };
    }
  }
  return null;
}

function splitPairAtFirstTopLevelColon(pairText: string): { before: string; after: string } | null {
  return splitAtFirstTopLevelDelimiter(pairText, ":");
}

/** Strip outer ASCII quotes from a JS string literal token. */
function stripQuotes(token: string): string {
  const t = token.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Replace identifier references that match binding names with initializer source (handles nested uses like `ignorePropertyModificationsFor: ignoredProps`). */
function substituteBindingsOnce(
  trimmed: string,
  bindings: Map<string, string>,
  skipNames: Set<string>
): string {
  if (!bindings.size) return trimmed;
  const HEADER = "void (";
  const FOOTER = ");";
  const wrappedSrc = `${HEADER}${trimmed}${FOOTER}`;
  let ast: SgRoot<JS>;
  try {
    ast = parse("javascript", wrappedSrc) as SgRoot<JS>;
  } catch {
    return trimmed;
  }
  const OFFSET = HEADER.length;
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  const ids = ast.root().findAll({
    rule: {
      kind: "identifier",
    },
  });

  for (const id of ids) {
    const name = id.text();
    if (skipNames.has(name)) continue;
    const repl = bindings.get(name);
    if (repl === undefined) continue;
    const r = id.range();
    const start = r.start.index - OFFSET;
    const end = r.end.index - OFFSET;
    if (start < 0 || end > trimmed.length) continue;
    if (trimmed.slice(start, end) !== name) continue;
    replacements.push({ start, end, text: repl.trim() });
  }

  replacements.sort((a, b) => b.start - a.start);
  let out = trimmed;
  for (const rep of replacements) {
    out = out.slice(0, rep.start) + rep.text + out.slice(rep.end);
  }
  return out;
}

function substituteBindingsInExprSource(
  trimmed: string,
  bindings: Map<string, string>,
  skipNames: Set<string>
): string {
  let current = trimmed;
  for (let i = 0; i < 8; i++) {
    const next = substituteBindingsOnce(current, bindings, skipNames);
    if (next === current) break;
    current = next;
  }
  return current;
}

function resolveRuleValueRaw(
  valueAfterColon: string,
  bindings: Map<string, string>,
  skipNames: Set<string>
): string {
  const trimmed = valueAfterColon.trim();
  const simpleId = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.exec(trimmed);
  if (simpleId && bindings.has(trimmed)) {
    // Keep a bare `airbnbBase`-style binding as the imported identifier, not `require(...)`.
    if (skipNames.has(trimmed)) return trimmed;
    return bindings.get(trimmed) as string;
  }
  return substituteBindingsInExprSource(trimmed, bindings, skipNames);
}

/** Top-level `const name = require('pkg')` with a static string specifier → ESM import lines. */
function parseStaticRequireRhs(rhsTrimmed: string): { specifier: string } | null {
  try {
    const wrapped = parse("javascript", `const __bind_req_probe = ${rhsTrimmed};`) as SgRoot<JS>;
    const decl = wrapped.root().find({
      rule: {
        kind: "variable_declarator",
      },
    });
    const call = decl?.find({
      rule: {
        kind: "call_expression",
      },
    });
    if (!call) return null;
    const callee = call.child(0);
    if (!callee || callee.kind() !== "identifier" || callee.text() !== "require") return null;
    const argStr = call.find({
      rule: {
        kind: "string",
      },
    });
    if (!argStr) return null;
    return { specifier: stripQuotes(argStr.text()) };
  } catch {
    return null;
  }
}

function collectRequireImportsFromProgram(
  rootNode: SgNode<JS>
): Array<{ binding: string; specifier: string }> {
  const raw: Array<{ binding: string; specifier: string }> = [];
  const declarators = rootNode.findAll({
    rule: {
      kind: "variable_declarator",
    },
  });
  for (const decl of declarators) {
    const sp = splitAtFirstTopLevelDelimiter(decl.text().trim(), "=");
    if (!sp) continue;
    const binding = /^([a-zA-Z_$][\w$]*)/.exec(sp.before.trim())?.[1];
    if (!binding) continue;
    const req = parseStaticRequireRhs(sp.after.trim());
    if (!req) continue;
    raw.push({ binding, specifier: req.specifier });
  }
  const seen = new Set<string>();
  const out: Array<{ binding: string; specifier: string }> = [];
  for (const row of raw) {
    const key = `${row.binding}\0${row.specifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function specifierAlreadyInImports(imports: string[], specifier: string): boolean {
  const esc = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`from\\s+["']${esc}["']`);
  return imports.some((line) => re.test(line));
}

/** Delete a rule entry whether the key was stored as `name`, `"name"`, or legacy quoted artifacts from the old extractor. */
function deleteRuleKeys(rules: Record<string, string>, logicalName: string): void {
  delete rules[logicalName];
  delete rules[`"${logicalName}"`];
  delete rules[`'${logicalName}'`];
  delete rules[`'"${logicalName}"'`];
  delete rules[`"'${logicalName}'"`];
}

function pairNodeToRuleEntry(
  pairNode: SgNode<JS>,
  bindings: Map<string, string>,
  skipImportBindings: Set<string>
): { key: string; value: string } | null {
  const split = splitPairAtFirstTopLevelColon(pairNode.text());
  if (!split) return null;
  const key = normalizePairKey(split.before);
  const value = resolveRuleValueRaw(split.after, bindings, skipImportBindings);
  return { key, value };
}

function hasSameRange(a: SgNode<JS>, b: SgNode<JS>): boolean {
  const ra = a.range();
  const rb = b.range();
  return ra.start.index === rb.start.index && ra.end.index === rb.end.index;
}

function orderedDirectObjectMembers(objNode: SgNode<JS>): SgNode<JS>[] {
  const out: SgNode<JS>[] = [];
  for (const n of objNode.findAll({ rule: { kind: "pair" } })) {
    const p = n.parent();
    if (p && hasSameRange(p as SgNode<JS>, objNode)) out.push(n);
  }
  for (const n of objNode.findAll({ rule: { kind: "spread_element" } })) {
    const p = n.parent();
    if (p && hasSameRange(p as SgNode<JS>, objNode)) out.push(n);
  }
  return out.sort((a, b) => {
    const ra = a.range().start;
    const rb = b.range().start;
    return ra.line !== rb.line ? ra.line - rb.line : ra.column - rb.column;
  });
}

function resolveIdentifierInitializerText(
  idNode: SgNode<JS>,
  bindings: Map<string, string>
): string | null {
  const name = idNode.text();
  const fromBindings = bindings.get(name);
  if (fromBindings !== undefined) return fromBindings;

  if (typeof idNode.definition !== "function") return null;
  const def = idNode.definition();
  if (!def || def.kind !== "local") return null;
  const bindingSite = def.node;
  const declarator = bindingSite.parent();
  if (!declarator || declarator.kind() !== "variable_declarator") return null;
  const declText = declarator.text().trim();
  const sp = splitAtFirstTopLevelDelimiter(declText, "=");
  return sp?.after.trim() ?? null;
}

function resolveInitializerToObjectNode(
  initText: string,
  bindings: Map<string, string>,
  depth: number
): SgNode<JS> | null {
  if (depth > 32) return null;
  const text = initText.trim();
  const simpleId = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.exec(text);
  if (simpleId && bindings.has(text)) {
    return resolveInitializerToObjectNode(bindings.get(text) as string, bindings, depth + 1);
  }

  const wrapped = parse("javascript", `const __spreadProbe = (${text});`) as SgRoot<JS>;
  const declarator = wrapped.root().find({
    rule: {
      kind: "variable_declarator",
    },
  });
  const obj = declarator?.find({
    rule: {
      kind: "object",
    },
  });
  return obj ?? null;
}

function extractRulesFromObjectExpression(
  rulesObj: SgNode<JS>,
  bindings: Map<string, string>,
  visitedSpreadVars: Set<string>,
  skipImportBindings: Set<string>
): Record<string, string> {
  const merged: Record<string, string> = {};
  const members = orderedDirectObjectMembers(rulesObj);

  for (const member of members) {
    if (member.kind() === "spread_element") {
      const spreadId = member.find({ rule: { kind: "identifier" } }) as SgNode<JS> | null;
      const name = spreadId?.text();
      if (!spreadId || !name) continue;
      if (visitedSpreadVars.has(name)) continue;
      visitedSpreadVars.add(name);

      const initText = resolveIdentifierInitializerText(spreadId, bindings);
      if (initText === null) {
        merged[`...${name}`] = "";
        continue;
      }
      const spreadObj = resolveInitializerToObjectNode(initText, bindings, 0);
      if (!spreadObj) {
        merged[`...${name}`] = "";
        continue;
      }
      const inner = extractRulesFromObjectExpression(
        spreadObj,
        bindings,
        visitedSpreadVars,
        skipImportBindings
      );
      Object.assign(merged, inner);
      continue;
    }

    const parsed = pairNodeToRuleEntry(member, bindings, skipImportBindings);
    if (!parsed) continue;
    merged[parsed.key] = parsed.value;
  }

  return merged;
}

function getRulesValueExpression(rulesPair: SgNode<JS>): SgNode<JS> | null {
  const candidates = rulesPair
    .findAll({
      rule: {
        any: [{ kind: "object" }, { kind: "identifier" }],
      },
    })
    .filter((n) => {
      const p = n.parent();
      return !!(p && hasSameRange(p as SgNode<JS>, rulesPair));
    });
  return candidates[0] ?? null;
}

function extractSectorRules(
  sector: SgNode<JS>,
  bindings: Map<string, string>,
  skipImportBindings: Set<string>
): Record<string, string> {
  const rulesPair = findRulesPair(sector);
  if (!rulesPair) return {};

  const valueExpr = getRulesValueExpression(rulesPair);
  if (!valueExpr) return {};

  if (valueExpr.kind() === "object") {
    return extractRulesFromObjectExpression(valueExpr, bindings, new Set(), skipImportBindings);
  }

  if (valueExpr.kind() === "identifier") {
    const init = resolveIdentifierInitializerText(valueExpr, bindings);
    if (init === null) return {};
    const obj = resolveInitializerToObjectNode(init, bindings, 0);
    if (!obj) return {};
    return extractRulesFromObjectExpression(obj, bindings, new Set(), skipImportBindings);
  }

  return {};
}

async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root();
  const source = rootNode.text();
  const fileBindings = collectBindingsFromProgram(rootNode);

  const staticRequireImportBindings = new Set(
    collectRequireImportsFromProgram(rootNode).map((r) => r.binding)
  );

  const rulesSectorsRule = rootNode.findAll({
    rule: {
      any: [
        {
          kind: "object",
          inside: {
            kind: "assignment_expression",
            has: {
              kind: "member_expression",
              regex: "module.exports",
            },
          },
        },
        {
          kind: "object",
          inside: {
            kind: "export_statement",
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

  const imports: string[] = [];

  const sectors: SectorData[] = [];

  for (let sector of rulesSectorsRule) {
    const sectorData: SectorData = {
      rules: {} as Record<string, string>,
      extends: [] as string[], // Preserved extends exactly as they were
      languageOptions: {} as LanguageOptions,
      files: String() as string,
      excludedFiles: String() as string,
      plugins: [] as Array<{ key: string; identifier: string }>,
      requireJsdoc: {
        exists: false,
        settings: {},
      },
      extendsTodoComments: [] as string[], // TODO comments for extends
      linterOptions: undefined as Record<string, string> | undefined,
      ignorePatterns: [] as string[],
    };
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
          kind: "property_identifier",
          regex: "^parser$",
        },
      },
    });
    let parser = "";
    if (parserPairRule) {
      // Find the string value in the pair
      const parserValueRule = parserPairRule.find({
        rule: {
          kind: "string",
        },
      });
      if (parserValueRule) {
        let parserString = parserValueRule.text();
        // Remove quotes
        if (
          (parserString[0] === "'" && parserString[parserString.length - 1] === "'") ||
          (parserString[0] === '"' && parserString[parserString.length - 1] === '"')
        ) {
          parserString = parserString.slice(1, -1);
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
    // remove sector overrides
    const overridesRule = sector.find({
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
      const overrides = overridesRule?.text();
      let newSectorText = sector.text();
      newSectorText = newSectorText.replace(overrides, "");
      const newSectorRoot = parse("javascript", newSectorText) as SgRoot<JS>;
      sector = newSectorRoot.root();
    }

    // start detecting rules (pairs + object spreads + identifier-valued rule entries via bindings / semantic locals)
    sectorData.rules = extractSectorRules(sector, fileBindings, staticRequireImportBindings);
    // end detecting rules

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
    for (const jsdoc of requireJsdocRule) {
      const identifier = jsdoc.getMatch("IDENTIFIER")?.text();
      if (identifier === "rules") {
        const pair = jsdoc
          ?.getMatch("PAIR")
          ?.text()
          .trim()
          .replace("'require-jsdoc':", "")
          .replace('"require-jsdoc":', "")
          .trim();
        if (
          (pair?.[0] === '"' && pair?.[pair.length - 1] === '"') ||
          (pair?.[0] === "'" && pair?.[pair.length - 1] === "'")
        ) {
          jsDocs.type = pair.substring(1, pair.length - 1);
          continue;
        }
        const jsdocTypeRule = jsdoc.find({
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
        const jsdocOptionsRule = jsdoc.findAll({
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
          const jsdocType = jsdocTypeRule.getMatch("TYPE")?.text() || "";
          const jsdocOptions: Record<string, string> = {};
          if (jsdocOptionsRule.length) {
            const optionsIdentifier = jsdocOptionsRule[0]?.getMatch("SETTING_IDENTIFIER")?.text();
            if (optionsIdentifier === "require") {
              for (const option of jsdocOptionsRule) {
                const identifier = option.getMatch("IDENTIFIER")?.text();
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
    deleteRuleKeys(sectorData.rules, "require-jsdoc");
    deleteRuleKeys(sectorData.rules, "valid-jsdoc");
    if (
      (jsDocs.type !== "nothing" && jsDocs.type !== "off") ||
      getState<boolean>("doesJsDocCommentExist") === true
    ) {
      sectorData.requireJsdoc.exists = true;
      sectorData.requireJsdoc.settings = jsDocs.options;
      imports.push('import { jsdoc } from "eslint-plugin-jsdoc";');
    }
    // end jsDocs section
    // start no-constructor-return and no-sequences section
    let noConstructorReturn = "";
    const noConstructorReturnRule = sector.find({
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
      const isArrayRule = noConstructorReturnRule.findAll({
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
          (rule) => rule.getMatch("TYPE")?.text() !== "no-constructor-return"
        );
        if (typeRule.length) {
          noConstructorReturn = typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noConstructorReturn) {
      deleteRuleKeys(sectorData.rules, "no-constructor-return");
      sectorData.rules["no-constructor-return"] = `["${noConstructorReturn}"]`;
    }

    const noSequences = {
      type: "nothing",
      allowInParenthesesExists: false,
      allowInParentheses: false,
    };
    const noSequencesRule = sector.find({
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
      const isArrayRule = noSequencesRule.findAll({
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
        const noSequencesRuleTypeObject = isArrayRule.filter((rule) => {
          const noSequencesRuleType = rule.getMatch("TYPE")?.text() || "";
          const arrayRule = rule.getMatch("ARRAY");
          if (arrayRule) {
            array = arrayRule;
          }
          return !!["error", "warn"].includes(noSequencesRuleType);
        });
        if (noSequencesRuleTypeObject) {
          const noSequencesRuleType = noSequencesRuleTypeObject[0]?.text() ?? "";
          noSequences.type = noSequencesRuleType;
          const allowInParenthesesOptionRule = array?.find({
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
            noSequences.allowInParentheses = allowInParenthesesOption === "true";
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
        typeRule = typeRule.filter((rule) => rule.getMatch("TYPE")?.text() !== "no-sequences");
        if (typeRule.length) {
          noSequences.type = typeRule[0]?.getMatch("TYPE")?.text() ?? "";
        }
      }
    }
    if (noSequences.type !== "nothing") {
      deleteRuleKeys(sectorData.rules, "no-sequences");
      if (
        typeof noSequences.allowInParentheses === "boolean" &&
        noSequences.allowInParenthesesExists === true
      ) {
        sectorData.rules["no-sequences"] =
          `["${noSequences.type}", {"allowInParentheses": ${noSequences.allowInParentheses}}]`;
      } else {
        sectorData.rules["no-sequences"] = `["${noSequences.type}"]`;
      }
    }

    // Extract extends from the sector - preserve exactly as they were
    const extendsRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          kind: "property_identifier",
          regex: "extends",
        },
      },
    });

    const preservedExtends: string[] = [];

    if (extendsRule) {
      // Check if extends is an array or single string
      const isArrayRule = extendsRule.findAll({
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
        // Array of extends
        for (const extendNode of isArrayRule) {
          const extendText = extendNode.getMatch("STRING")?.text() || "";
          preservedExtends.push(extendText);
        }
      } else {
        // Single string extends
        const extendsExecute = extendsRule.find({
          rule: {
            kind: "string_fragment",
            inside: {
              kind: "string",
            },
          },
        });
        const extendText = extendsExecute?.text() || "";
        if (extendText) {
          preservedExtends.push(extendText);
        }
      }
    }

    // Store extends exactly as they were
    sectorData.extends = preservedExtends;

    // Extract plugins from the sector - preserve exactly as they were
    const pluginsRule = sector.find({
      rule: {
        kind: "pair",
        inside: {
          kind: "object",
          any: [
            {
              nthChild: 1,
            },
            {
              inside: {
                kind: "array",
                inside: {
                  kind: "pair",
                  has: {
                    kind: "property_identifier",
                    nthChild: 1,
                    regex: "overrides",
                  },
                },
              },
            },
          ],
        },
        has: {
          kind: "property_identifier",
          regex: "plugins",
          nthChild: 1,
        },
      },
    });

    if (pluginsRule) {
      // Check if plugins is an object or array
      const pluginsObject = pluginsRule.find({
        rule: {
          kind: "object",
        },
      });

      if (pluginsObject) {
        // Extract all plugin pairs from the object
        const pluginPairs = pluginsObject.findAll({
          rule: {
            kind: "pair",
            pattern: "$PAIR",
            has: {
              any: [
                {
                  kind: "property_identifier",
                  pattern: "$PLUGIN_NAME",
                },
                {
                  kind: "string",
                  nthChild: 1,
                  pattern: "$PLUGIN_NAME",
                },
              ],
            },
          },
        });

        for (const pluginPair of pluginPairs) {
          let pluginName = pluginPair.getMatch("PLUGIN_NAME")?.text() || "";
          // Remove quotes if present
          if (
            (pluginName[0] === '"' && pluginName[pluginName.length - 1] === '"') ||
            (pluginName[0] === "'" && pluginName[pluginName.length - 1] === "'")
          ) {
            pluginName = pluginName.slice(1, -1);
          }

          // Get the plugin value (could be a string, identifier, or require call)
          let pluginValue = pluginPair.text().trim();
          // Remove the plugin name and colon
          pluginValue = pluginValue.replace(new RegExp(`^["']?${pluginName}["']?:\\s*`), "").trim();
          // Remove trailing comma if present
          pluginValue = pluginValue.replace(/,\s*$/, "");

          // Preserve the plugin exactly as it was
          const pluginImport = makePluginImport(pluginName);
          imports.push(`import ${pluginImport.identifier} from "${pluginImport.packageName}";`);
          sectorData.plugins?.push({ key: pluginName, identifier: pluginImport.identifier });
        }
      } else {
        // Plugins might be an array
        const pluginsArray = pluginsRule.find({
          rule: {
            kind: "array",
          },
        });

        if (pluginsArray) {
          const pluginStrings = pluginsArray.findAll({
            rule: {
              kind: "string_fragment",
              pattern: "$PLUGIN",
              inside: {
                kind: "string",
              },
            },
          });

          for (const pluginString of pluginStrings) {
            const pluginText = pluginString.getMatch("PLUGIN")?.text() || "";
            // For array plugins, use the plugin name as both key and value
            const pluginImport = makePluginImport(pluginText);
            imports.push(`import ${pluginImport.identifier} from "${pluginImport.packageName}";`);
            sectorData.plugins?.push({ key: pluginText, identifier: pluginImport.identifier });
          }
        }
      }
    }
    // ============================================
    // END COMPREHENSIVE EXTENDS MIGRATION
    // ============================================
    // start execute no-unused-vars
    const noUnusedVars = {
      type: "nothing",
      options: {
        caughtErrors: "none",
      } as Record<string, string | number | boolean>,
    };
    const noUnusedVarsRule = sector.find({
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
      const isArrayRule = noUnusedVarsRule.findAll({
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
        const optionsRule = noUnusedVarsRule.findAll({
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
        for (const option of optionsRule) {
          const identifier = option.getMatch("IDENTIFIER")?.text();
          let value: string | number | boolean = option
            .text()
            .trim()
            .replace(`${identifier}:`, "")
            .trim();
          if (!identifier) continue;
          if (value === "true" || value === "false") {
            value = value === "true";
          } else if (!Number.isNaN(Number.parseInt(value))) {
            value = Number.parseInt(value);
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
        typeRule = typeRule.filter((rule) => rule.getMatch("TYPE")?.text() !== "no-unused-vars");
        if (typeRule.length) {
          noUnusedVars.type = typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noUnusedVars.type !== "nothing") {
      deleteRuleKeys(sectorData.rules, "no-unused-vars");
      if (Object.keys(noUnusedVars.options).length) {
        sectorData.rules["no-unused-vars"] = `["${
          noUnusedVars.type
        }", ${JSON.stringify(noUnusedVars.options)}]`;
      } else {
        sectorData.rules["no-unused-vars"] = `["${noUnusedVars.type}"]`;
      }
    }
    // end execute no-unused-vars
    // start no-useless-computed-key
    const noUselessComputedKeys = {
      type: "nothing",
      options: {
        enforceForClassMembers: false,
      } as Record<string, string | number | boolean>,
    };
    const noUselessComputedVarsRule = sector.find({
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
      const isArrayRule = noUselessComputedVarsRule.findAll({
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
        noUselessComputedKeys.type = isArrayRule[0]?.getMatch("TYPE")?.text() || "";
        const optionsRule = noUselessComputedVarsRule.findAll({
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
        for (const option of optionsRule) {
          const identifier = option.getMatch("IDENTIFIER")?.text();
          if (!identifier) continue;
          const value = option.text().trim().replace(`${identifier}:`, "").trim();
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
          (rule) => rule.getMatch("TYPE")?.text() !== "no-useless-computed-key"
        );
        if (typeRule.length) {
          noUselessComputedKeys.type = typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (noUselessComputedKeys.type !== "nothing") {
      deleteRuleKeys(sectorData.rules, "no-useless-computed-key");
      sectorData.rules["no-useless-computed-key"] =
        `["${noUselessComputedKeys.type}", {enforceForClassMembers: ${noUselessComputedKeys.options.enforceForClassMembers}}]`;
    }
    // end no-useless-computed-key
    // start camelcase
    const camelcase = {
      type: "nothing",
      options: {} as Record<string, string | boolean | number>,
    };
    const camelcaseRule = sector.find({
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
      const isArrayRule = camelcaseRule.findAll({
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
        const optionsRule = camelcaseRule.findAll({
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
        for (const option of optionsRule) {
          const identifier = option.getMatch("IDENTIFIER")?.text();
          if (!identifier) continue;
          let value: string | boolean | number = option
            .text()
            .trim()
            .replace(`${identifier}:`, "")
            .trim();
          if (value === "true" || value === "false") {
            value = value === "true";
            // biome-ignore lint/suspicious/noGlobalIsNan: string coercion is intentional — detects numeric option values like "ecmaVersion: 2020"
          } else if (!isNaN(value as unknown as number)) {
            value = Number.parseInt(value as string);
          }
          if (identifier === "allow") {
            const isUsingArray = option.find({
              rule: {
                kind: "array",
                pattern: "[$$$ITEMS]",
                inside: {
                  kind: "pair",
                },
              },
            });
            const items = isUsingArray?.getMultipleMatches("ITEMS");
            if (
              !items?.filter((item) => {
                const text = item.text();
                return text[0] !== "'" && text[0] !== '"' && text[0] !== "`" && text !== ",";
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
          (rule) => rule.getMatch("TYPE")?.text() !== "no-useless-computed-key"
        );
        if (typeRule.length) {
          noUselessComputedKeys.type = typeRule[0]?.getMatch("TYPE")?.text() || "";
        }
      }
    }
    if (camelcase.type !== "nothing") {
      deleteRuleKeys(sectorData.rules, "camelcase");
      sectorData.rules.camelcase = `["${camelcase.type}", ${JSON.stringify(camelcase.options)}]`;
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
    for (const noRestrictedImports of noRestrictedImportsRule) {
      const paths = noRestrictedImports.findAll({
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
        const noRestrictedImportsType = paths[0]?.getMatch("TYPE")?.text();
        let finalPaths: { name: string; content: string }[] = [];
        for (const [_index, path] of paths.entries()) {
          const pair = path.getMatch("PAIR");
          const nameRule = pair?.find({
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
            const name = nameRule.getMatch("NAME")?.text();
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
        deleteRuleKeys(sectorData.rules, "no-restricted-imports");
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
          const pairText = pair.text().trim().replaceAll(" ", "");
          if (
            pairText.startsWith("paths:") ||
            pairText.startsWith("'paths':") ||
            pairText.startsWith('"paths":')
          ) {
            return false;
          }
          return true;
        });
        sectorData.rules["no-restricted-imports"] =
          `["${noRestrictedImportsType}", {paths: [${finalPaths.map(
            (path) => path.content
          )}], ${pairs.map((pair) => `${pair.text()},`)}}]`;
      }
    }
    // end detecting no-restricted-imports

    // detect globals start
    const globals: Record<string, string | number | boolean> = {};
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
    for (const glob of detectGlobalsRule) {
      let identifier = glob.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: string | number | boolean = glob
        .text()
        .trim()
        .replace(`${identifier}:`, "")
        .trim();
      if (value === "true" || value === "false") {
        value = value === "true";
      } else if (!Number.isNaN(Number.parseInt(value))) {
        value = Number.parseInt(value);
      }
      if (
        (identifier[0] === "'" && identifier[identifier.length - 1] === "'") ||
        (identifier[0] === '"' && identifier[identifier.length - 1] === '"')
      ) {
        identifier = identifier.slice(1, identifier.length - 1);
      }
      globals[identifier] = value;
    }
    // detect globals end
    // start language options detection start
    const languageOptions: LanguageOptions = {
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
    for (const option of detectParserOptions) {
      const identifier = option.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: string | number | boolean = option
        .text()
        .trim()
        .replace(`${identifier}:`, "")
        .trim();
      if (value === "true" || value === "false") {
        value = value === "true";
      } else if (!Number.isNaN(Number.parseInt(value))) {
        value = Number.parseInt(value);
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
    for (const env of detectingEnvRule) {
      const identifier = env.getMatch("IDENTIFIER")?.text();
      if (!identifier) continue;
      let value: string | number | boolean = env.text().trim().replace(`${identifier}:`, "").trim();
      if (value === "true" || value === "false") {
        value = value === "true";
      } else if (!Number.isNaN(Number.parseInt(value))) {
        value = Number.parseInt(value);
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
    const filesValueDetection = sector.findAll({
      rule: {
        any: [
          {
            inside: {
              kind: "array",
              inside: {
                kind: "pair",
                has: {
                  kind: "property_identifier",
                  regex: "^files$",
                },
              },
            },
            any: [
              {
                kind: "string",
              },
              {
                kind: "identifier",
              },
            ],
          },
          {
            kind: "string",
            nthChild: 2,
            inside: {
              kind: "pair",
              has: {
                kind: "property_identifier",
                regex: "^files$",
              },
            },
          },
        ],
      },
    });
    if (filesValueDetection.length) {
      sectorData.files = `[${filesValueDetection
        .map((value) => value.text() as string)
        .filter((value) => value !== "")
        .join(", ")}]`;
    } else {
      sectorData.files = "[]";
    }
    // end files detection

    // start excludedFiles detection (flat config: ignores)
    const excludedFilesValueDetection = sector.findAll({
      rule: {
        any: [
          {
            inside: {
              kind: "array",
              inside: {
                kind: "pair",
                has: {
                  kind: "property_identifier",
                  regex: "^excludedFiles$",
                },
              },
            },
            any: [
              {
                kind: "string",
              },
              {
                kind: "identifier",
              },
            ],
          },
          {
            kind: "string",
            nthChild: 2,
            inside: {
              kind: "pair",
              has: {
                kind: "property_identifier",
                regex: "^excludedFiles$",
              },
            },
          },
        ],
      },
    });
    if (excludedFilesValueDetection.length) {
      sectorData.excludedFiles = `[${excludedFilesValueDetection
        .map((value) => value.text() as string)
        .filter((value) => value !== "")
        .join(", ")}]`;
    } else {
      sectorData.excludedFiles = "[]";
    }
    // end excludedFiles detection

    // start linterOptions detection (noInlineConfig, reportUnusedDisableDirectives)
    const linterOptions: Record<string, string> = {};

    const noInlineConfigRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          any: [
            {
              kind: "property_identifier",
              regex: "^noInlineConfig$",
            },
            {
              kind: "string",
              has: {
                kind: "string_fragment",
                regex: "^noInlineConfig$",
              },
            },
          ],
        },
        inside: {
          kind: "object",
        },
      },
    });
    if (noInlineConfigRule) {
      let pairText = noInlineConfigRule.text().trim();
      pairText = pairText
        .replace(/^["']?noInlineConfig["']?\s*:\s*/, "")
        .replace(/,\s*$/, "")
        .trim();
      if (pairText === "true" || pairText === "false") {
        linterOptions.noInlineConfig = pairText;
      }
    }

    const reportUnusedDisableDirectivesRule = sector.find({
      rule: {
        kind: "pair",
        has: {
          any: [
            {
              kind: "property_identifier",
              regex: "^reportUnusedDisableDirectives$",
            },
            {
              kind: "string",
              has: {
                kind: "string_fragment",
                regex: "^reportUnusedDisableDirectives$",
              },
            },
          ],
        },
        inside: {
          kind: "object",
        },
      },
    });
    if (reportUnusedDisableDirectivesRule) {
      let pairText = reportUnusedDisableDirectivesRule.text().trim();
      pairText = pairText
        .replace(/^["']?reportUnusedDisableDirectives["']?\s*:\s*/, "")
        .replace(/,\s*$/, "")
        .trim();
      if (pairText === "true") {
        // In eslintrc, `true` was equivalent to `"warn"` in flat config
        linterOptions.reportUnusedDisableDirectives = '"warn"';
      } else if (pairText === "false") {
        linterOptions.reportUnusedDisableDirectives = '"off"';
      } else if (pairText) {
        // Preserve any quoted severity string ("error", "warn", "off") as-is
        linterOptions.reportUnusedDisableDirectives = pairText;
      }
    }

    if (Object.keys(linterOptions).length > 0) {
      sectorData.linterOptions = linterOptions;
    }
    // end linterOptions detection

    // start execution ignorePatterns: {ignorePatterns: ["test", "m"]}
    const ignorePatternsRule = sector.findAll({
      rule: {
        inside: {
          kind: "array",
          inside: {
            kind: "pair",
            has: {
              kind: "property_identifier",
              regex: "ignorePatterns",
            },
          },
        },
        any: [
          {
            kind: "string",
          },
          {
            kind: "identifier",
          },
        ],
      },
    });
    if (ignorePatternsRule.length) {
      sectorData.ignorePatterns = ignorePatternsRule.map((rule) => rule.text().trim());
    }
    // end execution ignorePatterns: {ignorePatterns: ["test", "m"]}

    sectors.push(sectorData);
  }

  for (const req of collectRequireImportsFromProgram(rootNode)) {
    if (specifierAlreadyInImports(imports, req.specifier)) continue;
    const line = `import ${req.binding} from "${req.specifier}";`;
    if (!imports.includes(line)) imports.push(line);
  }

  const directory = path.dirname(root.filename()).replace(/[/\\]/g, "-");
  const newSource = makeNewConfig(sectors, imports, directory);

  // if not changes return null
  if (newSource === source) {
    return null;
  }
  return newSource;
}

export default transform;
