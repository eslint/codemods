import { type SgRoot, type Edit, parse } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { type SgNode } from "codemod:ast-grep";
import { setStepOutput } from "codemod:workflow";

export default async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  let fileJsdocs: SgNode<JS>[] = rootNode.findAll({
    rule: {
      kind: "comment",
      any: [
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+("|')require-jsdoc("|')\s*:\s*\[("|')(error|warn)("|')[^\]]*\]\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+require-jsdoc\s*:\s*\[("|')(error|warn)("|')[^\]]*\]\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+require-jsdoc\s*:\s*("|')(error|warn)("|')\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+("|')require-jsdoc("|')\s*:\s*\[("|')(error|warn)("|')[^\]]*\]\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+valid-jsdoc\s*:\s*("|')(error|warn)("|')\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+valid-jsdoc\s*:\s*\[("|')(error|warn)("|')[^\]]*\]\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+valid-jsdoc\s*:\s*\[("|')(error|warn)("|')[^\]]*\]\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*eslint\s+valid-jsdoc\s*:\s*\[[^\]]*\]\s*\*/`,
        },
      ],
    },
  });

  let isJsdoccommentExists = false;

  for (let fileJsdoc of fileJsdocs) {
    isJsdoccommentExists = true;
    edits.push(fileJsdoc.replace(""));
  }

  setStepOutput("isJsdoccommentExists", isJsdoccommentExists.toString());

  let newSource = rootNode.commitEdits(edits);

  return newSource;
}
