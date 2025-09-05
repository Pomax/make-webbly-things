const PREFIX = `/v1`;

// Make sure that "fetch()" automatically prepends the API
// so that we don't need to include that in ever call:
const fetch = (...args) =>
  globalThis.fetch(`${PREFIX}/${args.shift()}`, ...args);

export const API = {
  // Project related calls, such as getting project health,
  // restarting the container, updating settings, etc.
  projects: {
    download: async (projectName) => {
      const a = document.createElement(`a`);
      a.href = `${PREFIX}/projects/download/${projectName}`;
      a.click();
    },
    remix: async (projectName) => {
      location = `${PREFIX}/projects/remix/${projectName}`;
    },
    health: async (projectName) =>
      fetch(`projects/health/${projectName}?v=${Date.now()}`).then((r) =>
        r.text(),
      ),
    restart: async (projectName) =>
      fetch(`projects/restart/${projectName}`, {
        method: `POST`,
      }),
  },

  // File related calls, which are mostly "CRUD"
  // (create/read/update/delete) operations.
  files: {
    dir: async (projectName) =>
      fetch(`files/dir/${projectName}`).then((r) => r.json()),
    create: async (projectName, fileName) =>
      fetch(`files/create/${projectName}/${fileName}`, { method: `post` }),
    upload: async (projectName, fileName, form) =>
      fetch(`files/upload/${projectName}/${fileName}`, {
        method: `post`,
        body: form,
      }),
    get: async (projectName, fileName) =>
      fetch(`files/content/${projectName}/${fileName}`),
    rename: async (projectName, oldPath, newPath) =>
      fetch(`files/rename/${projectName}/${oldPath}:${newPath}`, {
        method: `post`,
      }),
    format: async (projectName, fileName) =>
      fetch(`files/format/${projectName}/${fileName}`, {
        method: `post`,
      }),
    sync: async (projectName, fileName, changes) =>
      fetch(`files/sync/${projectName}/${fileName}`, {
        headers: { "Content-Type": `text/plain` },
        method: `post`,
        body: changes,
      }),
    delete: async (projectName, fileName) =>
      fetch(`files/delete/${projectName}/${fileName}`, {
        method: `delete`,
      }),
    // NOTE: there is no separate delete-dir, the delete route should just "do what needs to be done".
  },
};
