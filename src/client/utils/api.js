const PREFIX = `/v1`;

// Make sure that "fetch()" automatically prepends the API
// so that we don't need to include that in ever call:
const fetch = (...args) =>
  globalThis.fetch(`${PREFIX}/${args.shift()}`, ...args);

export const API = {
  // Project related calls, such as getting project health,
  // restarting the container, updating settings, etc.
  projects: {
    download: async (projectSlug) => {
      const a = document.createElement(`a`);
      a.href = `${PREFIX}/projects/download/${projectSlug}`;
      a.click();
    },
    health: async (projectSlug) =>
      fetch(`projects/health/${projectSlug}?v=${Date.now()}`).then((r) =>
        r.text(),
      ),
    remix: async (projectSlug) => {
      location = `${PREFIX}/projects/remix/${projectSlug}`;
    },
    restart: async (projectSlug) =>
      fetch(`projects/restart/${projectSlug}`, {
        method: `POST`,
      }),
  },

  // File related calls, which are mostly "CRUD"
  // (create/read/update/delete) operations.
  files: {
    create: async (projectSlug, fileName) =>
      fetch(`files/create/${projectSlug}/${fileName}`, { method: `post` }),
    delete: async (projectSlug, fileName) =>
      fetch(`files/delete/${projectSlug}/${fileName}`, {
        method: `delete`,
      }),
    // NOTE: there is no separate delete-dir, the delete route should just "do what needs to be done".
    dir: async (projectSlug) =>
      fetch(`files/dir/${projectSlug}`).then((r) => r.json()),
    format: async (projectSlug, fileName) =>
      fetch(`files/format/${projectSlug}/${fileName}`, {
        method: `post`,
      }),
    get: async (projectSlug, fileName) =>
      fetch(`files/content/${projectSlug}/${fileName}`),
    history: async (projectSlug, fileName) =>
      fetch(`files/history/${projectSlug}/${fileName}`).then((r) => r.json()),
    rename: async (projectSlug, oldPath, newPath) =>
      fetch(`files/rename/${projectSlug}/${oldPath}:${newPath}`, {
        method: `post`,
      }),
    sync: async (projectSlug, fileName, changes) =>
      fetch(`files/sync/${projectSlug}/${fileName}`, {
        headers: { "Content-Type": `text/plain` },
        method: `post`,
        body: changes,
      }),
    upload: async (projectSlug, fileName, form) =>
      fetch(`files/upload/${projectSlug}/${fileName}`, {
        method: `post`,
        body: form,
      }),
  },
};
