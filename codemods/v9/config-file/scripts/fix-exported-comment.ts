import { type Edit, type SgNode, type SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";

export default async function transform(root: SgRoot<JS>): Promise<string> {
  const rootNode = root.root();
  const edits: Edit[] = [];

  let exportedComments: SgNode<JS>[] = rootNode.findAll({
    rule: {
      kind: "comment",
      regex: String.raw`^\/\*\s*exported\s+.*\*\/`,
    },
  });

  for (let comment of exportedComments) {
    const commentText = comment.text();
    const match = commentText.match(/^\/\*\s*exported\s+(.*?)\s*\*\/$/);
    if (!match || !match[1]) continue;
    const content = match[1];
    let cleaned = content.replace(/:\s*(true|false)/g, "");
    const variables = cleaned
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(v));
    if (variables.length === 0) continue;
    const newComment = `/* exported ${variables.join(", ")} */`;
    if (commentText !== newComment) {
      edits.push(comment.replace(newComment));
    }
  }

  let newSource = rootNode.commitEdits(edits);

  return newSource;
}
