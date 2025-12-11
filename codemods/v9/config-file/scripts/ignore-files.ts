import type { SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { setStepOutput, getOrSetStepOutput } from "codemod:workflow";
import path from "path";

async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root();
  const source = rootNode.text();
  let directory = path.dirname(root.filename()).replace(/[\/\\]/g, "-");
  let ignoreFiles = source.split("\n").filter((line) => line.trim() !== "");

  const beforeIgnoreFilesStr = getOrSetStepOutput(
    "scan-ignore-files",
    `ignoreFiles-${directory}`,
    "[]"
  );
  const beforeIgnoreFiles = JSON.parse(beforeIgnoreFilesStr) as string[];
  ignoreFiles = [...beforeIgnoreFiles, ...ignoreFiles];

  setStepOutput(
    `ignoreFiles-${directory}`,
    JSON.stringify(
      ignoreFiles.filter((file) => !file.startsWith("#")),
      null,
      2
    )
  );
  return null;
}

export default transform;
