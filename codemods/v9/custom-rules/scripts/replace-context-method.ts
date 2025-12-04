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

// ============ Transform ============

export default async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  const createRule = rootNode.find(getCreateBlockSelector());

  if (createRule) {
    // Skip if already transformed (contextSourceCode already defined)
    if (createRule.find(getAlreadyTransformedSelector())) {
      return rootNode.text();
    }

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

    for (let expression of expressions) {
      let identifier = expression.getMatch("IDENTIFIER");
      let property = expression.getMatch("PROPERTY");
      if (!identifier || !property) continue;
      if (identifier.text() !== context) continue;

      let propertyText = property.text();

      if (propertyText in CONTEXT_METHOD_MAP) {
        newRootEdits.push(property.replace(CONTEXT_METHOD_MAP[propertyText]!));
      } else if (propertyText === "getComments") {
        newRootEdits.push(
          expression.replace(
            `contextSourceCode.getCommentsBefore() + contextSourceCode.getCommentsInside() + contextSourceCode.getCommentsAfter()`
          )
        );
      } else if (propertyText === "getAncestors" || propertyText === "getScope") {
        newRootEdits.push(
          expression.replace(`contextSourceCode.${propertyText}(node) /* TODO: new node param */`)
        );
      } else if (propertyText === "markVariableAsUsed") {
        newRootEdits.push(
          expression.replace(
            `contextSourceCode.markVariableAsUsed(name, node) /* TODO: new name, node params */`
          )
        );
      }

      newRootEdits.push(identifier.replace("contextSourceCode"));
    }

    // Only transform if there are actual changes
    if (newRootEdits.length === 0) {
      return rootNode.text();
    }

    text = newRoot.commitEdits(newRootEdits);

    let newCreate = `{
    const contextSourceCode = ${context}.sourceCode ?? ${context}.getSourceCode();${text.substring(1)}`;
    edits.push(createRule.replace(newCreate));
  }

  return rootNode.commitEdits(edits);
}
