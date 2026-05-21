import type { Edit, SgNode, SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { setState } from "codemod:workflow";

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

  let doesJsDocCommentExist = false;

  for (const fileJsdoc of fileJsdocs) {
    doesJsDocCommentExist = true;
    edits.push(fileJsdoc.replace(""));
  }

  if (doesJsDocCommentExist) {
    setState("doesJsDocCommentExist", true);
  }

  const newSource = rootNode.commitEdits(edits);

  // if not changes return null
  if (newSource === rootNode.text()) {
    return null;
  }
  return newSource;
}
