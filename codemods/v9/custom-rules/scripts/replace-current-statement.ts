import { type Edit, type SgRoot, type RuleConfig, parse } from "codemod:ast-grep";
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
        regex: "^newCurrentCodePath$",
      },
    },
  };
}

function getCurrentSegmentsSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "member_expression",
      has: {
        kind: "property_identifier",
        regex: "^currentSegments$",
      },
    },
  };
}

// ============ Constants ============

const CODE_PATH_HANDLERS = `onCodePathStart(codePath) {
        newCurrentCodePath = codePath;
        allCurrentSegments.push(newCurrentSegments);
        newCurrentSegments = new Set();
      },
      onCodePathEnd(codePath) {
        newCurrentCodePath = codePath.upper;
        newCurrentSegments = allCurrentSegments.pop();
      },
      onCodePathSegmentStart(segment) {
        newCurrentSegments.add(segment);
      },
      onCodePathSegmentEnd(segment) {
        newCurrentSegments.delete(segment);
      },
      onUnreachableCodePathSegmentStart(segment) {
        newCurrentSegments.add(segment);
      },
      onUnreachableCodePathSegmentEnd(segment) {
        newCurrentSegments.delete(segment);
      },`;

// ============ Transform ============

export default async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  const createRule = rootNode.find(getCreateBlockSelector());

  if (createRule) {
    // Skip if already transformed (newCurrentCodePath already defined)
    if (createRule.find(getAlreadyTransformedSelector())) {
      return rootNode.text();
    }

    // Skip if no currentSegments usage
    if (!createRule.find(getCurrentSegmentsSelector())) {
      return rootNode.text();
    }

    const text = createRule.text();
    let newEdits: Edit[] = [];
    let newRoot = parse("javascript", text).root();

    // Replace currentSegments references
    const memberExpressions = newRoot.findAll({
      rule: {
        kind: "member_expression",
        has: {
          kind: "property_identifier",
          regex: "^currentSegments$",
        },
      },
    });
    for (let expression of memberExpressions) {
      newEdits.push(expression.replace("newCurrentSegments"));
    }

    // Add code path handlers to return objects
    const returnStatements = newRoot.findAll({
      rule: {
        kind: "object",
        inside: {
          kind: "return_statement",
        },
      },
    });
    for (let returnStatement of returnStatements) {
      let returnStatementText = returnStatement.text();

      if (
        returnStatementText[0] === "{" &&
        returnStatementText[returnStatementText.length - 1] === "}"
      ) {
        const innerContent = returnStatementText.slice(1, -1);
        newEdits.push(
          returnStatement.replace(`{
      ${CODE_PATH_HANDLERS}
      ${innerContent}
    }`)
        );
      } else {
        newEdits.push(
          returnStatement.replace(`{
      ${returnStatementText},
      ${CODE_PATH_HANDLERS}
    }`)
        );
      }
    }

    // Only transform if there are actual changes
    if (newEdits.length === 0) {
      return rootNode.text();
    }

    let newText = newRoot.commitEdits(newEdits);
    let newCreate = `{
    let newCurrentCodePath;
    let newCurrentSegments;
    const allCurrentSegments = [];
    ${newText.slice(1)}`;
    edits.push(createRule.replace(newCreate));
  }

  return rootNode.commitEdits(edits);
}
