import { type Edit, type SgRoot, parse } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";

export default async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  const createRule = rootNode.find({
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
                regex: "create",
              },
            },
          },
          {
            kind: "arrow_function",
            inside: {
              kind: "pair",
              has: {
                kind: "property_identifier",
                regex: "create",
              },
            },
          },
        ],
      },
    },
  });

  if (createRule) {
    let newEdits = [];
    let newRoot = parse("javascript", createRule.text()).root();
    let context = createRule.getMatch("CONTEXT")?.text() || "context";
    const memberExpressionsRule = newRoot.findAll({
      rule: {
        kind: "member_expression",
        has: {
          kind: "property_identifier",
          regex: "currentSegments",
        },
      },
    });
    if (memberExpressionsRule.length) {
      for (let expression of memberExpressionsRule) {
        newEdits.push(expression.replace("newCurrentSegments"));
      }
    }

    let returnStatementsRule = newRoot.findAll({
      rule: {
        kind: "object",
        inside: {
          kind: "return_statement",
        },
      },
    });

    for (let returnStatement of returnStatementsRule) {
      let returnStatementText = returnStatement.text();
      if (
        returnStatementText[0] == "{" &&
        returnStatementText[returnStatementText.length - 1] == "}"
      ) {
        newEdits.push(
          returnStatement.replace(`{
                onCodePathStart(codePath) {
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
                },
                ${returnStatementText.slice(1, returnStatementText.length - 1)}
              }`)
        );
      } else {
        newEdits.push(
          returnStatement.replace(`{
          ${returnStatementText},
          onCodePathStart(codePath) {
            newCurrentCodePath = codePath;
            allCurrentSegments.push(newCurrentSegments);
            currentSegments = new Set();
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
          },
        }`)
        );
      }
    }

    let text = newRoot.commitEdits(newEdits as Edit[]);
    let newCreate = `{
    let newCurrentCodePath;
    let newCurrentSegments;
    const allCurrentSegments = [];
    ${text.slice(1, text.length)}`;
    edits.push(createRule.replace(newCreate));
  }

  let newSource = rootNode.commitEdits(edits);

  return newSource;
}
