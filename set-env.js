import {
  parseEnvironment,
  writeEnvironment,
  NO_UPDATE,
} from "./src/parse-environment.js";

const [_node, _script, key, value] = process.argv;
const varSet = parseEnvironment(`.env`, NO_UPDATE);
varSet[key] = value;
console.log(varSet);
writeEnvironment(`.env`, varSet);
