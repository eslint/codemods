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

// Selector for object with create property (used to find rules missing meta)
function getObjectWithCreateSelector(): RuleConfig<JS> {
  return {
    rule: {
      kind: "object",
      has: {
        kind: "pair",
        has: {
          kind: "property_identifier",
          regex: "^create$",
        },
      },
    },
  };
}

function hasMetaProperty(node: SgNode<JS>): boolean {
  const metaProp = node.find({
    rule: {
      kind: "pair",
      has: {
        kind: "property_identifier",
        regex: "^meta$",
      },
    },
  });
  return metaProp !== null;
}

// Check if a call expression is a RuleCreator call
function isRuleCreatorCall(callExpr: SgNode<JS>, root: SgRoot<JS>): boolean {
  const rootNode = root.root();

  // Get the callee - could be identifier or member_expression
  const callee = callExpr.find({ rule: { kind: "identifier" } });
  if (!callee) return false;

  const calleeName = callee.text();

  // Find variable declaration: const createRule = ESLintUtils.RuleCreator(...)
  const variableDeclarator = rootNode.find({
    rule: {
      kind: "variable_declarator",
      has: {
        kind: "identifier",
        regex: `^${calleeName}$`,
      },
    },
  });

  if (!variableDeclarator) return false;

  // Check if the value is a call to RuleCreator
  // Pattern: ESLintUtils.RuleCreator(...) or SomeImport.RuleCreator(...)
  const ruleCreatorCall = variableDeclarator.find({
    rule: {
      kind: "call_expression",
      has: {
        kind: "member_expression",
        has: {
          kind: "property_identifier",
          regex: "^RuleCreator$",
        },
      },
    },
  });

  if (!ruleCreatorCall) return false;

  // Get the object part (ESLintUtils or whatever name it's imported as)
  const memberExpr = ruleCreatorCall.find({ rule: { kind: "member_expression" } });
  if (!memberExpr) return false;

  const objectIdentifier = memberExpr.find({ rule: { kind: "identifier" } });
  if (!objectIdentifier) return false;

  const importedName = objectIdentifier.text();

  // Verify it's imported from @typescript-eslint/utils
  const importDecl = rootNode.find({
    rule: {
      kind: "import_statement",
      pattern: `import { $$$IMPORTS } from "@typescript-eslint/utils"`,
    },
  });

  if (importDecl) {
    // Check if ESLintUtils (or the used name) is in the imports
    const hasCorrectImport = importDecl.find({
      rule: {
        kind: "import_specifier",
        has: {
          kind: "identifier",
          regex: `^${importedName}$`,
        },
      },
    });
    if (hasCorrectImport) return true;
  }

  // Also check for: import { ESLintUtils as SomeName } from "@typescript-eslint/utils"
  const aliasedImport = rootNode.find({
    rule: {
      kind: "import_statement",
      has: {
        kind: "import_specifier",
        has: {
          kind: "identifier",
          regex: `^${importedName}$`,
        },
      },
    },
  });

  if (aliasedImport) {
    const importSource = aliasedImport.find({ rule: { kind: "string" } });
    if (importSource?.text().includes("@typescript-eslint/utils")) {
      return true;
    }
  }

  return false;
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

function generateMetaObject(
  fixableProperty: string,
  schemaValue: string,
  schemaComment: string
): string {
  return `meta: {
    docs: {},${fixableProperty}
    schema: ${schemaValue}${schemaComment}
  },`;
}

// Check if object is directly exported as ESLint rule
function isObjectExported(
  objectNode: SgNode<JS>,
  root: SgRoot<JS>
): {
  exported: boolean;
  style: ExportStyle;
  isCreateRule: boolean;
} {
  const parent = objectNode.parent();
  if (!parent) {
    return { exported: false, style: "commonjs", isCreateRule: false };
  }

  const parentKind = parent.kind();

  // Direct: module.exports = { create: ... }
  // The object's parent should be assignment_expression with module.exports
  if (parentKind === "assignment_expression") {
    const assignmentText = parent.text();
    if (
      assignmentText.startsWith("module.exports =") ||
      assignmentText.startsWith("module.exports=")
    ) {
      return { exported: true, style: "commonjs", isCreateRule: false };
    }
  }

  // Direct: export default { create: ... }
  // The object's parent should be export_statement
  if (parentKind === "export_statement") {
    return { exported: true, style: "esm", isCreateRule: false };
  }

  // createRule({ create: ... }) - object is direct child of arguments
  if (parentKind === "arguments") {
    const callExpr = parent.parent();
    if (callExpr?.kind() === "call_expression") {
      // Use proper AST analysis to verify it's a RuleCreator call
      if (isRuleCreatorCall(callExpr, root)) {
        return { exported: true, style: "esm", isCreateRule: true };
      }
    }
  }

  return { exported: false, style: "commonjs", isCreateRule: false };
}

// Find rules with create but no meta
function getRuleWithCreateNoMeta(
  root: SgRoot<JS>
): { node: SgNode<JS>; style: ExportStyle; isCreateRule: boolean } | null {
  const rootNode = root.root();

  // Find any object with a create property
  const objectsWithCreate = rootNode.findAll(getObjectWithCreateSelector());

  for (const objectNode of objectsWithCreate) {
    // Skip if it already has meta
    if (hasMetaProperty(objectNode)) {
      continue;
    }

    // Check if this object is actually being exported
    const exportInfo = isObjectExported(objectNode, root);
    if (exportInfo.exported) {
      return { node: objectNode, style: exportInfo.style, isCreateRule: exportInfo.isCreateRule };
    }
  }

  return null;
}

function getCreateFunctionFromObject(objectNode: SgNode<JS>): SgNode<JS> | null {
  return objectNode.find({
    rule: {
      kind: "pair",
      has: {
        kind: "property_identifier",
        regex: "^create$",
      },
    },
  });
}

function getContextNameFromCreatePair(createPair: SgNode<JS>): string {
  const funcNode = createPair.find(getFunctionParamSelector());
  const paramMatch = funcNode?.getMatch("PARAM");
  return paramMatch?.text() || "context";
}

// ============ Transform ============

async function transform(root: SgRoot<JS>): Promise<string | null> {
  // First, try to handle old format (direct function export)
  const ruleDefinition = getOldFormatRuleDefinition(root);
  if (ruleDefinition) {
    return transformOldFormat(root, ruleDefinition);
  }

  // Then, check if it has create but no meta
  const ruleWithCreateNoMeta = getRuleWithCreateNoMeta(root);
  if (ruleWithCreateNoMeta) {
    return addMetaToExistingRule(root, ruleWithCreateNoMeta);
  }

  return null;
}

async function transformOldFormat(
  root: SgRoot<JS>,
  ruleDefinition: { node: SgNode<JS>; style: ExportStyle }
): Promise<string> {
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

async function addMetaToExistingRule(
  root: SgRoot<JS>,
  ruleInfo: { node: SgNode<JS>; style: ExportStyle; isCreateRule: boolean }
): Promise<string> {
  const { node: objectNode } = ruleInfo;

  // Get context name from create function
  const createPair = getCreateFunctionFromObject(objectNode);
  const contextName = createPair ? getContextNameFromCreatePair(createPair) : "context";

  const isFixable = isRuleFixable(root, contextName);
  const schemaDefinitionNode = getOldFormatSchemaDefinition(root);
  const schemaValue = schemaDefinitionNode ? getSchemaValue(schemaDefinitionNode) : "[]";

  // Check if rule uses context.options but has no schema defined
  const hasOptions = usesContextOptions(root, contextName);
  const needsSchemaWarning = hasOptions && !schemaDefinitionNode;

  const fixableProperty = isFixable ? '\n    fixable: "code",' : "";
  const schemaComment = needsSchemaWarning
    ? " // TODO: Define schema - this rule uses context.options"
    : "";

  const metaObject = generateMetaObject(fixableProperty, schemaValue, schemaComment);

  let sourceText = root.root().text();

  // Remove schema definition (CommonJS only)
  if (schemaDefinitionNode) {
    const schemaStatement = schemaDefinitionNode.parent();
    if (schemaStatement) {
      sourceText = sourceText.replace(schemaStatement.text(), "");
    }
  }

  // Insert meta at the beginning of the object (after opening brace)
  const objectText = objectNode.text();
  const newObjectText = objectText.replace(/^\{/, `{\n  ${metaObject}\n `);
  sourceText = sourceText.replace(objectText, newObjectText);

  sourceText = sourceText.replace(/\n\n\n+/g, "\n\n");

  return sourceText;
}

export default transform;
