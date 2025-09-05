// Static content server, isolated to a single project and prespecified port.
import express from "express";
import { join } from "node:path";
import { setDefaultAspects } from "../helpers.js";
const projectName = process.argv[process.argv.indexOf(`--project`) + 1];
const port = process.argv[process.argv.indexOf(`--port`) + 1];
const root = process.argv[process.argv.indexOf(`--root`) + 1];
const app = express();
setDefaultAspects(app);
let staticDir = join(`content`, projectName, root.replaceAll(`"`, ``));
app.use(`/`, express.static(staticDir, { etag: false }));
app.listen(port, () =>
  console.log(`Static server for ${projectName} listening on port ${port}`),
);
