import type { SgRoot } from "codemod:ast-grep";
import type JS from "codemod:ast-grep/langs/javascript";
import { acquireLock, getState, setState } from "codemod:workflow";
import path from "path";

async function transform(root: SgRoot<JS>): Promise<string | null> {
  const rootNode = root.root();
  const source = rootNode.text();
  const directory = path.dirname(root.filename()).replace(/[/\\]/g, "-");
  const stateKey = `ignoreFiles-${directory}`;
  const release = acquireLock(stateKey);
  try {
    const beforeIgnoreFiles = getState<string[]>(stateKey) ?? [];
    let ignoreFiles = [
      ...beforeIgnoreFiles,
      ...source.split("\n").filter((line) => line.trim() !== ""),
    ];
    ignoreFiles = ignoreFiles
      .filter((file) => !file.startsWith("#"))
      .filter((file, index, self) => self.indexOf(file) === index)
      .map((file) => `"${file}"`);
    setState(stateKey, ignoreFiles);
  } finally {
    release();
  }

  const currentWorkingDirectory = process.cwd();
  const fileName = root.filename();
  const fileDirectory = path.dirname(fileName);
  const relativePath = fileDirectory !== currentWorkingDirectory ? "../" : "";
  root.rename(`${relativePath}deleted-eslintignore-backup.txt`);

  return null;
}

export default transform;
