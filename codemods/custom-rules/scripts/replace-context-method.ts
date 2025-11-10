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
    let text = createRule.text();
    let context = createRule.getMatch("CONTEXT")?.text() || "context";

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

    let newRootEdits = [];

    const changeMap = {
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

    for (let expression of expressions) {
      let identifier = expression.getMatch("IDENTIFIER");
      let property = expression.getMatch("PROPERTY");
      if (!identifier || !property) continue;
      if (identifier.text() != context) {
        continue;
      }
      let propertyText = property.text();
      if (Object.keys(changeMap).includes(propertyText)) {
        newRootEdits.push(
          property.replace(
            changeMap[propertyText as keyof typeof changeMap] as string
          )
        );
      } else if (propertyText == "getComments") {
        newRootEdits.push(
          expression.replace(
            `contextSourceCode.getCommentsBefore() + contextSourceCode.getCommentsInside() + contextSourceCode.getCommentsAfter()`
          )
        );
      } else if (propertyText == "getAncestors" || propertyText == "getScope") {
        newRootEdits.push(
          expression.replace(
            `contextSourceCode.${propertyText}(node) //TODO: new node param \n`
          )
        );
      } else if (propertyText == "markVariableAsUsed") {
        newRootEdits.push(
          expression.replace(
            `contextSourceCode.markVariableAsUsed(name, node) //TODO: new name, code params \n`
          )
        );
      }

      newRootEdits.push(identifier.replace("contextSourceCode"));
    }

    text = newRoot.commitEdits(newRootEdits);

    let newCreate = `{
        const contextSourceCode = ${context}.sourceCode ?? ${context}.getSourceCode();${text.substring(
      1,
      text.length
    )}`;
    edits.push(createRule.replace(newCreate));
  }

  let newSource = rootNode.commitEdits(edits);

  return newSource;
}
