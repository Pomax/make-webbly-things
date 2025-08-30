// Static content server, isolated to a single project and prespecified port.
import express from "express";
import { setDefaultAspects } from "../helpers.js";
const projectName = process.argv[process.argv.indexOf(`--project`) + 1];
const port = process.argv[process.argv.indexOf(`--port`) + 1];
const app = express();
setDefaultAspects(app);
app.use(`/`, express.static(`content/${projectName}`, { etag: false }));
app.listen(port, () =>
  console.log(`Static server for ${projectName} listening on port ${port}`)
);
