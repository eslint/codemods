import { type SgRoot } from "codemod:ast-grep";
import type YAML from "codemod:ast-grep/langs/yaml";
import type JSON from "codemod:ast-grep/langs/json";
import type JS from "codemod:ast-grep/langs/javascript";
import path from "path";
import jsYaml from "js-yaml";
import jsonTransform from "./transform-json-config.ts";
import jsTransform from "./transform-js-config.ts";
import { parse } from "codemod:ast-grep";

async function transform(root: SgRoot<YAML | JSON | JS>): Promise<string | null> {
  const text = root.root().text();
  const fileName = root.filename();
  const fileExtension = path.basename(fileName).split(".").pop()?.toLowerCase();

  root.rename("eslint.config.mjs");

  if (fileExtension === "js" || fileExtension === "cjs" || fileExtension === "mjs") {
    return jsTransform(root as unknown as SgRoot<JS>);
  } else if (fileExtension === "json") {
    return jsonTransform(root as unknown as SgRoot<JSON>);
  } else if (fileExtension === "yaml" || fileExtension === "yml") {
    const yamlObject = jsYaml.load(text);
    const jsonRoot = parse("json", JSON.stringify(yamlObject)) as unknown as SgRoot<JSON>;
    return jsonTransform(jsonRoot as unknown as SgRoot<JSON>);
  }

  return null;
}

export default transform;
