import { parse, type SgRoot } from "codemod:ast-grep";
import type JSON from "codemod:ast-grep/langs/json";
import jsonTransform from "./transform-json-config.ts";
import fs from "fs/promises";
import path from "path";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function transform(root: SgRoot<JSON>): Promise<string | null> {
  const rootNode = root.root();
  const fileName = root.filename();
  const directory = path.dirname(fileName);

  const eslintConfigRule = rootNode.find({
    rule: {
      kind: "pair",
      has: {
        kind: "string",
        nthChild: 1,
        has: {
          kind: "string_content",
          regex: "eslintConfig",
        },
      },
    },
  });

  if (eslintConfigRule) {
    const pairText = eslintConfigRule.text().trim();
    const newRoot = parse("json", pairText);
    const newEslintConfigRule = await jsonTransform(newRoot as unknown as SgRoot<JSON>);
    if (!(await fileExists(path.join(directory, "eslint.config.mjs")))) {
      await fs.writeFile(
        path.join(directory, "eslint.config.mjs"),
        newEslintConfigRule as unknown as string
      );
      const next = eslintConfigRule.next();
      const prev = eslintConfigRule.prev();
      const edits = [eslintConfigRule.replace("")];
      if (next?.text() == ",") {
        edits.push(next.replace(""));
      }
      if (
        (next?.text() == "}" || (next?.text() == "," && next?.next()?.text() == "}")) &&
        prev?.text() == ","
      ) {
        edits.push(prev.replace(""));
      }
      return rootNode.commitEdits(edits);
    } else {
      throw new Error(
        `eslint.config.mjs file already exists in ${path.join(directory, "eslint.config.mjs")} and eslintConfig inside package.json cannot be migrated to eslint.config.mjs`
      );
    }
  }

  return null;
}

export default transform;
