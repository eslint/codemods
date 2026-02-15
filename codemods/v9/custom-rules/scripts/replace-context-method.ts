import { type Edit, type SgRoot, type RuleConfig, type SgNode, parse } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";

// ============ Selectors ============

function getCreateBlockSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "statement_block",
      inside: {
        any: [
          {
            kind: "function_expression",
            inside: {
              kind: "pair",
              has: {
                kind: "property_identifier",
                regex: "^create$",
              },
            },
          },
          {
            kind: "arrow_function",
            inside: {
              kind: "pair",
              has: {
                kind: "property_identifier",
                regex: "^create$",
              },
            },
          },
        ],
      },
    },
  };
}

function getAlreadyTransformedSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "variable_declarator",
      has: {
        kind: "identifier",
        regex: "^contextSourceCode$",
      },
    },
  };
}

// ============ Constants ============

// Context methods that became properties (deprecated in favor of property; use property ?? method())
const CONTEXT_METHOD_TO_PROPERTY: Record<string, string> = {
  getSourceCode: "sourceCode",
  getFilename: "filename",
  getPhysicalFilename: "physicalFilename",
  getCwd: "cwd",
};

// Methods that move from context to sourceCode (with optional rename)
const CONTEXT_METHOD_MAP: Record<string, string> = {
  getSource: "getText",
  getSourceLines: "getLines",
  getAllComments: "getAllComments",
  getNodeByRangeIndex: "getNodeByRangeIndex",
  getCommentsBefore: "getCommentsBefore",
  getCommentsAfter: "getCommentsAfter",
  getCommentsInside: "getCommentsInside",
  getJSDocComment: "getJSDocComment",
  getFirstToken: "getFirstToken",
  getFirstTokens: "getFirstTokens",
  getLastToken: "getLastToken",
  getLastTokens: "getLastTokens",
  getTokenAfter: "getTokenAfter",
  getTokenBefore: "getTokenBefore",
  getTokenByRangeStart: "getTokenByRangeStart",
  getTokens: "getTokens",
  getTokensAfter: "getTokensAfter",
  getTokensBefore: "getTokensBefore",
  getTokensBetween: "getTokensBetween",
  parserServices: "parserServices",
  getDeclaredVariables: "getDeclaredVariables",
};

// Methods that STAY on context - do NOT transform these
const CONTEXT_ONLY_METHODS = [
  "report",
  "options",
  "settings",
  "parserPath",
  "parserOptions",
  "languageOptions",
];

// ============ Helpers ============

function extractContextName(createRule: SgNode<JS>): string {
  let context = "context";
  const parentFunction = createRule.parent();

  if (parentFunction) {
    const formalParams = parentFunction.find({ rule: { kind: "formal_parameters" } });
    if (formalParams) {
      const firstParam = formalParams.find({ rule: { kind: "identifier" } });
      if (firstParam) {
        context = firstParam.text();
      }
    } else if (parentFunction.kind() === "arrow_function") {
      const firstChild = parentFunction.find({ rule: { kind: "identifier" } });
      if (firstChild) {
        context = firstChild.text();
      }
    }
  }

  return context;
}

function isOldStyleReport(argsNode: SgNode<JS>): boolean {
  const children = argsNode.children();
  const args = children.filter(
    (child) => child.kind() !== "(" && child.kind() !== ")" && child.kind() !== ","
  );

  // Old style has 2 or 3 arguments where first is not an object
  if (args.length < 2) return false;

  const firstArg = args[0];
  if (!firstArg) return false;

  return firstArg.kind() !== "object";
}

function transformOldStyleReport(expression: SgNode<JS>, contextName: string): string | null {
  const argsNode = expression.find({ rule: { kind: "arguments" } });
  if (!argsNode) return null;

  const children = argsNode.children();
  const args = children.filter(
    (child) => child.kind() !== "(" && child.kind() !== ")" && child.kind() !== ","
  );

  if (args.length < 2) return null;

  const nodeArg = args[0]?.text();
  const messageArg = args[1]?.text();
  const dataArg = args[2]?.text();

  if (!nodeArg || !messageArg) return null;

  if (dataArg) {
    return `${contextName}.report({ node: ${nodeArg}, message: ${messageArg}, data: ${dataArg} })`;
  } else {
    return `${contextName}.report({ node: ${nodeArg}, message: ${messageArg} })`;
  }
}

// ============ Transform ============

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  const createRule = rootNode.find(getCreateBlockSelector());

  if (!createRule) {
    return null;
  }

  // Check if contextSourceCode is already defined (sourceCode methods already transformed)
  const alreadyHasContextSourceCode = !!createRule.find(getAlreadyTransformedSelector());

  let text = createRule.text();
  const context = extractContextName(createRule);

  let newRoot = parse("javascript", text).root();
  const expressions = newRoot.findAll({
    rule: {
      kind: "call_expression",
      has: {
        kind: "member_expression",
        pattern: "$IDENTIFIER.$PROPERTY",
      },
    },
  });
  let newRootEdits: Edit[] = [];
  let needsContextSourceCode = false;

  for (let expression of expressions) {
    let identifier = expression.getMatch("IDENTIFIER");
    let property = expression.getMatch("PROPERTY");
    if (!identifier || !property) continue;
    if (identifier.text() !== context) continue;

    let propertyText = property.text();

    // Leave context-only methods unchanged (no transform)
    if (CONTEXT_ONLY_METHODS.includes(propertyText)) continue;

    // Transform deprecated context methods to property access (property ?? method())
    if (propertyText in CONTEXT_METHOD_TO_PROPERTY) {
      const prop = CONTEXT_METHOD_TO_PROPERTY[propertyText]!;
      newRootEdits.push(expression.replace(`${context}.${prop} ?? ${context}.${propertyText}()`));
      continue;
    }

    // Skip sourceCode method transformations if already done
    if (!alreadyHasContextSourceCode) {
      if (propertyText in CONTEXT_METHOD_MAP) {
        newRootEdits.push(property.replace(CONTEXT_METHOD_MAP[propertyText]!));
        newRootEdits.push(identifier.replace("contextSourceCode"));
        needsContextSourceCode = true;
      } else if (propertyText === "getComments") {
        newRootEdits.push(
          expression.replace(
            `[...contextSourceCode.getCommentsBefore(), ...contextSourceCode.getCommentsInside(), ...contextSourceCode.getCommentsAfter()]`
          )
        );
        needsContextSourceCode = true;
      } else if (propertyText === "getAncestors" || propertyText === "getScope") {
        newRootEdits.push(
          expression.replace(`contextSourceCode.${propertyText}(node) /* TODO: new node param */`)
        );
        needsContextSourceCode = true;
      } else if (propertyText === "markVariableAsUsed") {
        newRootEdits.push(
          expression.replace(
            `contextSourceCode.markVariableAsUsed(name, node) /* TODO: new name, node params */`
          )
        );
        needsContextSourceCode = true;
      }
    }

    if (propertyText === "report") {
      // Transform old-style context.report(node, message, data) to new object format
      const argsNode = expression.find({ rule: { kind: "arguments" } });
      if (argsNode && isOldStyleReport(argsNode as unknown as SgNode<JS>)) {
        const transformed = transformOldStyleReport(expression as unknown as SgNode<JS>, context);
        if (transformed) {
          newRootEdits.push(expression.replace(transformed));
        }
      }
    }
  }

  // Only transform if there are actual changes
  if (newRootEdits.length === 0) {
    return null;
  }

  text = newRoot.commitEdits(newRootEdits);

  let newCreate: string;
  if (needsContextSourceCode) {
    newCreate = `{
    const contextSourceCode = ${context}.sourceCode ?? ${context}.getSourceCode();${text.substring(1)}`;
  } else {
    newCreate = text;
  }
  edits.push(createRule.replace(newCreate));

  return rootNode.commitEdits(edits);
}
