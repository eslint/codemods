import { type Edit, type SgNode, type SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";

export default async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  let eslintComments: SgNode<JS>[] = rootNode.findAll({
    rule: {
      kind: "comment",
      any: [
        {
          kind: "comment",
          regex: String.raw`^\/\*\s*eslint\s+[\w\/@-]+\s*:[\s\S]*\*\/$`,
        },
      ],
    },
  });

  for (let comment of eslintComments.slice(0, eslintComments.length - 1)) {
    edits.push(comment.replace(""));
  }

  let newSource = rootNode.commitEdits(edits);

  // if not changes return null
  if (newSource === rootNode.text()) {
    return null;
  }
  return newSource;
}
