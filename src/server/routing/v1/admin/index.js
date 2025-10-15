import {
  bindCommonValues,
  verifyAdmin,
  verifyLogin,
} from "../../middleware.js";

import {
  back,
  deleteProject,
  deleteUser,
  disableUser,
  enableUser,
  loadAdminData,
  stopContainer,
  stopServer,
  toggleSuperUser,
  suspendProject,
  suspendUser,
  unsuspendProject,
  unsuspendUser,
} from "./middleware.js";

import { Router } from "express";
export const admin = Router();

const prechecks = [bindCommonValues, verifyLogin, verifyAdmin];

admin.get(`/`, ...prechecks, loadAdminData, (req, res) =>
  res.render(`admin.html`, { ...res.locals, ...req.session, ...process.env }),
);

admin.get(`/toggle/superuser`, ...prechecks, toggleSuperUser, back);

admin.post(`/server/stop/:name`, ...prechecks, stopServer, back);
admin.post(`/container/stop/:image`, ...prechecks, stopContainer, back);

admin.post(`/user/delete/:uid`, ...prechecks, deleteUser, back);
admin.post(`/user/disable/:uid`, ...prechecks, disableUser, back);
admin.post(`/user/enable/:uid`, ...prechecks, enableUser, back);
admin.post(`/user/suspend/:uid`, ...prechecks, suspendUser, back);
admin.post(`/user/unsuspend/:sid`, ...prechecks, unsuspendUser, back);

admin.post(`/project/delete/:pid`, ...prechecks, deleteProject, back);
admin.post(`/project/suspend/:pid`, ...prechecks, suspendProject, back);
admin.post(`/project/unsuspend/:sid`, ...prechecks, unsuspendProject, back);
