import { Router } from "express";
import { projects } from "./projects/index.js";
import { files } from "./files/index.js";
import { users } from "./users/index.js";
import { admin } from "./admin/index.js";

export function setupRoutesV1(app) {
  const router = Router();
  router.use(`/projects`, projects);
  router.use(`/files`, files);
  router.use(`/users`, users);
  router.use(`/admin`, admin);
  app.use(`/v1`, router);
  // import("./print-routes.js").then(lib => lib.printRoutes(app));
}
