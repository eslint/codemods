import { type SgRoot, type RuleConfig } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { type SgNode } from "codemod:ast-grep";

type ExportStyle = "commonjs" | "esm";

function getCommonJSRuleSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "assignment_expression",
      any: [
        { pattern: "module.exports = function($$$PARAMS) { $$$BODY }" },
        { pattern: "module.exports = ($$$PARAMS) => { $$$BODY }" },
        { pattern: "module.exports = ($$$PARAMS) => $BODY" },
        { pattern: "module.exports = $PARAM => { $$$BODY }" },
        { pattern: "module.exports = $PARAM => $BODY" },
      ],
    },
  };
}

function getESMRuleSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "export_statement",
      any: [
        { pattern: "export default function($$$PARAMS) { $$$BODY }" },
        { pattern: "export default function $NAME($$$PARAMS) { $$$BODY }" },
        { pattern: "export default ($$$PARAMS) => { $$$BODY }" },
        { pattern: "export default ($$$PARAMS) => $BODY" },
        { pattern: "export default $PARAM => { $$$BODY }" },
        { pattern: "export default $PARAM => $BODY" },
      ],
    },
  };
}

function getCommonJSSchemaSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "assignment_expression",
      pattern: "module.exports.schema = $SCHEMA",
    },
  };
}

function getContextReportSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "call_expression",
      pattern: "$CTX.report($$$ARGS)",
    },
  };
}

function getReturnObjectSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "return_statement",
      has: {
        kind: "object",
      },
    },
  };
}

function getFunctionParamSelector(): RuleConfig<JS> {
  return {
    rule: {
      any: [
        { pattern: "function($PARAM, $$$REST) { $$$BODY }" },
        { pattern: "function($PARAM) { $$$BODY }" },
        { pattern: "function $NAME($PARAM, $$$REST) { $$$BODY }" },
        { pattern: "function $NAME($PARAM) { $$$BODY }" },
        { pattern: "($PARAM, $$$REST) => { $$$BODY }" },
        { pattern: "($PARAM) => { $$$BODY }" },
        { pattern: "$PARAM => { $$$BODY }" },
        { pattern: "$PARAM => $BODY" },
      ],
    },
  };
}

function getFixableReportSelector(contextName: string): RuleConfig<JS> {
  return {
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
  };
}

function getCommonJSFuncSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "assignment_expression",
      pattern: "module.exports = $FUNC",
    },
  };
}

function getESMFuncSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "export_statement",
      pattern: "export default $FUNC",
    },
  };
}

function getContextOptionsSelector(contextName: string): RuleConfig<JS> {
  return {
    rule: {
      kind: "member_expression",
      any: [{ pattern: `${contextName}.options` }, { pattern: `${contextName}.options[$$$]` }],
    },
  };
}

// ============ Validation ============

const VISITOR_METHODS = [
  "Program",
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "Identifier",
  "CallExpression",
  "MemberExpression",
  "VariableDeclaration",
  "IfStatement",
  "ForStatement",
  "WhileStatement",
  "ClassDeclaration",
  "ImportDeclaration",
  "ExportDefaultDeclaration",
];

function isEslintRule(root: SgRoot<JS>, ruleNode: SgNode<JS>): boolean {
  const rootNode = root.root();

  // Check if module.exports.schema exists (strong indicator of ESLint rule - CommonJS only)
  if (rootNode.find(getCommonJSSchemaSelector())) return true;

  // Check if context.report() is called inside the function
  if (ruleNode.find(getContextReportSelector())) return true;

  // Check if function returns an object with AST visitor methods
  const returnStatement = ruleNode.find(getReturnObjectSelector());
  if (returnStatement) {
    for (const method of VISITOR_METHODS) {
      const hasVisitor = returnStatement.find({
        rule: {
          kind: "property_identifier",
          regex: `^${method}$`,
        },
      });
      if (hasVisitor) return true;
    }
  }

  return false;
}

// ============ Extractors ============

function getOldFormatRuleDefinition(
  root: SgRoot<JS>
): { node: SgNode<JS>; style: ExportStyle } | null {
  const rootNode = root.root();

  // Try CommonJS first
  const commonJSNode = rootNode.find(getCommonJSRuleSelector());
  if (commonJSNode && isEslintRule(root, commonJSNode)) {
    return { node: commonJSNode, style: "commonjs" };
  }

  // Try ESM
  const esmNode = rootNode.find(getESMRuleSelector());
  if (esmNode && isEslintRule(root, esmNode)) {
    return { node: esmNode, style: "esm" };
  }

  return null;
}

function getOldFormatSchemaDefinition(root: SgRoot<JS>): SgNode<JS> | null {
  return root.root().find(getCommonJSSchemaSelector());
}

function getContextParameterName(ruleNode: SgNode<JS>): string {
  const functionNode = ruleNode.find(getFunctionParamSelector());
  const paramMatch = functionNode?.getMatch("PARAM");
  return paramMatch?.text() || "context";
}

function isRuleFixable(root: SgRoot<JS>, contextName: string): boolean {
  return root.root().find(getFixableReportSelector(contextName)) !== null;
}

function usesContextOptions(root: SgRoot<JS>, contextName: string): boolean {
  return root.root().find(getContextOptionsSelector(contextName)) !== null;
}

function getSchemaValue(schemaNode: SgNode<JS>): string {
  const schemaValue = schemaNode.find(getCommonJSSchemaSelector());
  const schema = schemaValue?.getMatch("SCHEMA");
  return schema?.text() || "[]";
}

function getRuleFunction(ruleNode: SgNode<JS>, style: ExportStyle, contextName: string): string {
  if (style === "commonjs") {
    const assignmentNode = ruleNode.find(getCommonJSFuncSelector());
    const func = assignmentNode?.getMatch("FUNC");
    if (func) {
      return func.text();
    }
  } else {
    const exportNode = ruleNode.find(getESMFuncSelector());
    const func = exportNode?.getMatch("FUNC");
    if (func) {
      return func.text();
    }
  }
  return `function(${contextName}) { return {}; }`;
}

function generateNewFormat(
  style: ExportStyle,
  fixableProperty: string,
  schemaValue: string,
  schemaComment: string,
  ruleFunction: string
): string {
  if (style === "commonjs") {
    return `module.exports = {
  meta: {
    docs: {},${fixableProperty}
    schema: ${schemaValue}${schemaComment}
  },
  create: ${ruleFunction}
};`;
  } else {
    return `export default {
  meta: {
    docs: {},${fixableProperty}
    schema: ${schemaValue}${schemaComment}
  },
  create: ${ruleFunction}
};`;
  }
}

// ============ Transform ============

async function transform(root: SgRoot<JS>): Promise<string> {
  const ruleDefinition = getOldFormatRuleDefinition(root);
  if (!ruleDefinition) {
    return root.root().text();
  }

  const { node: ruleDefinitionNode, style } = ruleDefinition;

  const contextName = getContextParameterName(ruleDefinitionNode);
  const isFixable = isRuleFixable(root, contextName);
  const schemaDefinitionNode = getOldFormatSchemaDefinition(root);
  const schemaValue = schemaDefinitionNode ? getSchemaValue(schemaDefinitionNode) : "[]";

  // Check if rule uses context.options but has no schema defined
  const hasOptions = usesContextOptions(root, contextName);
  const needsSchemaWarning = hasOptions && !schemaDefinitionNode;

  const ruleFunction = getRuleFunction(ruleDefinitionNode, style, contextName);
  const fixableProperty = isFixable ? '\n    fixable: "code",' : "";
  const schemaComment = needsSchemaWarning
    ? " // TODO: Define schema - this rule uses context.options"
    : "";

  const newFormat = generateNewFormat(
    style,
    fixableProperty,
    schemaValue,
    schemaComment,
    ruleFunction
  );

  let sourceText = root.root().text();

  // Remove schema definition (CommonJS only)
  if (schemaDefinitionNode) {
    const schemaStatement = schemaDefinitionNode.parent();
    if (schemaStatement) {
      sourceText = sourceText.replace(schemaStatement.text(), "");
    }
  }

  // Replace rule definition
  if (style === "commonjs") {
    const ruleStatement = ruleDefinitionNode.parent();
    if (ruleStatement) {
      sourceText = sourceText.replace(ruleStatement.text(), newFormat);
    }
  } else {
    // For ESM, the export_statement is the full statement
    sourceText = sourceText.replace(ruleDefinitionNode.text(), newFormat);
  }

  sourceText = sourceText.replace(/\n\n\n+/g, "\n\n");

  return sourceText;
}

export default transform;
