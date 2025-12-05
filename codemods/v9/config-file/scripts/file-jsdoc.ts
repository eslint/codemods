import { type Edit, type SgNode, type SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { setStepOutput } from "codemod:workflow";

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  const fileJsdocs: SgNode<JS>[] = rootNode.findAll({
    rule: {
      kind: "comment",
      any: [
        {
          kind: "comment",
          regex: String.raw`^/\*\s*eslint\s+["']?require-jsdoc["']?\s*:\s*(?:\[[^\]]*\]|["'](?:error|warn)["'])\s*\*/`,
        },
        {
          kind: "comment",
          regex: String.raw`^/\*\s*eslint\s+["']?valid-jsdoc["']?\s*:\s*(?:\[[^\]]*\]|["'](?:error|warn)["'])\s*\*/`,
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

  // if not changes return null
  if (newSource === rootNode.text()) {
    return null;
  }
  return newSource;
}
