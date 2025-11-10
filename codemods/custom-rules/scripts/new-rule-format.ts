import { type SgRoot, parse } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { type SgNode } from "codemod:ast-grep";

function getOldFormatRuleDefinition(root: SgRoot<JS>): SgNode<JS> | null {
  const rootNode = root.root();

  return rootNode.find({
    rule: {
      kind: "assignment_expression",
      any: [
        {
          pattern: "module.exports = function($$$PARAMS) { $$$BODY }",
        },
        {
          pattern: "module.exports = ($$$PARAMS) => { $$$BODY }",
        },
        {
          pattern: "module.exports = ($$$PARAMS) => $BODY",
        },
        {
          pattern: "module.exports = $PARAM => { $$$BODY }",
        },
        {
          pattern: "module.exports = $PARAM => $BODY",
        },
      ],
    },
  });
}

function getOldFormatSchemaDefinition(root: SgRoot<JS>): SgNode<JS> | null {
  const rootNode = root.root();

  return rootNode.find({
    rule: {
      kind: "assignment_expression",
      pattern: "module.exports.schema = $SCHEMA",
    },
  });
}

function getContextParameterName(ruleNode: SgNode<JS>): string {
  const functionNode = ruleNode.find({
    rule: {
      any: [
        {
          pattern: "function($PARAM, $$$REST) { $$$BODY }",
        },
        {
          pattern: "function($PARAM) { $$$BODY }",
        },
        {
          pattern: "($PARAM, $$$REST) => { $$$BODY }",
        },
        {
          pattern: "($PARAM) => { $$$BODY }",
        },
        {
          pattern: "$PARAM => { $$$BODY }",
        },
        {
          pattern: "$PARAM => $BODY",
        },
      ],
    },
  });

  const paramMatch = functionNode?.getMatch("PARAM");
  return paramMatch?.text() || "context";
}

function isRuleFixable(root: SgRoot<JS>, contextName: string): boolean {
  const rootNode = root.root();

  const fixProperty = rootNode.find({
    rule: {
      kind: "call_expression",
      pattern: `${contextName}.report({ $$$PROPS })`,
      has: {
        kind: "pair",
        has: {
          kind: "property_identifier",
          regex: "^fix$",
        },
      },
    },
  });

  return fixProperty !== undefined;
}

function getSchemaValue(schemaNode: SgNode<JS>): string {
  const schemaValue = schemaNode.find({
    rule: {
      kind: "assignment_expression",
      pattern: "module.exports.schema = $SCHEMA",
    },
  });

  const schema = schemaValue?.getMatch("SCHEMA");
  return schema?.text() || "[]";
}

function getRuleFunction(ruleNode: SgNode<JS>): string {
  const patterns = ["module.exports = $FUNC"];

  for (const pattern of patterns) {
    const assignmentNode = ruleNode.find({
      rule: {
        kind: "assignment_expression",
        pattern: pattern,
      },
    });

    const func = assignmentNode?.getMatch("FUNC");
    if (func) {
      return func.text();
    }
  }

  return "function(context) { return {}; }";
}

async function transform(root: SgRoot<JS>): Promise<string> {
  const ruleDefinitionNode = getOldFormatRuleDefinition(root);
  if (!ruleDefinitionNode) {
    return root.root().text();
  }

  const contextName = getContextParameterName(ruleDefinitionNode);
  const isFixable = isRuleFixable(root, contextName);
  const schemaDefinitionNode = getOldFormatSchemaDefinition(root);
  const schemaValue = schemaDefinitionNode
    ? getSchemaValue(schemaDefinitionNode)
    : "[]";

  const ruleFunction = getRuleFunction(ruleDefinitionNode);
  const fixableProperty = isFixable ? '\n    fixable: "code",' : "";
  const newFormat = `module.exports = {
    meta: {
        docs: {},${fixableProperty}
        schema: ${schemaValue}
    },
    create: ${ruleFunction}
};`;

  let sourceText = root.root().text();

  if (schemaDefinitionNode) {
    const schemaStatement = schemaDefinitionNode.parent();
    if (schemaStatement) {
      sourceText = sourceText.replace(schemaStatement.text(), "");
    }
  }

  const ruleStatement = ruleDefinitionNode.parent();
  if (ruleStatement) {
    sourceText = sourceText.replace(ruleStatement.text(), newFormat);
  }

  sourceText = sourceText.replace(/\n\n\n+/g, "\n\n");

  return sourceText;
}

export default transform;
