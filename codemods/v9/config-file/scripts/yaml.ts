import { type SgRoot, parse } from "codemod:ast-grep";
import type YAML from "codemod:ast-grep/langs/yaml";
import type JSON from "codemod:ast-grep/langs/json";
import * as jsYaml from "js-yaml";
import jsonTransform from "./json.ts";

async function transform(root: SgRoot<YAML>): Promise<string> {
  const yamlText = root.root().text();
  const yamlObject = jsYaml.load(yamlText);
  let jsonRoot = parse("json", JSON.stringify(yamlObject));

  let newConfig = jsonTransform(jsonRoot as unknown as SgRoot<JSON>);
  return newConfig;
}

export default transform;
