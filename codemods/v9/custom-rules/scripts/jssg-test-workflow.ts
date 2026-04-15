import type { SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { parse } from "codemod:ast-grep";
import newRuleFormat from "./new-rule-format.ts";
import replaceContextMethod from "./replace-context-method.ts";
import replaceCurrentStatement from "./replace-current-statement.ts";

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
    const rootNode = root.root();
    let text = rootNode.text();
    text = await newRuleFormat(root) ?? text;
    text = await replaceContextMethod(parse("javascript", text)) ?? text;
    text = await replaceCurrentStatement(parse("javascript", text)) ?? text;
    return text;
}