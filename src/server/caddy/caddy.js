import { readFileSync, writeFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { join } from "node:path";
import { scheduleScreenShot } from "../screenshots/screenshot.js";
import { BYPASS_CADDY } from "../../helpers.js";

const caddyFile = join(import.meta.dirname, `Caddyfile`);
const defaultCaddyFile = join(import.meta.dirname, `Caddyfile.default`);

export const portBindings = {};

/**
 * For docker containers, the port binding is pretty much just a
 * simple slug-to-port mapping. But for static servers we also
 * want a reference to the actual process so we can .kill() it.
 */
export class PortBinding {
  port;
  serverProcess;
  restarts = 0;
  constructor(p) {
    this.port = parseFloat(p);
  }
}

/**
 * Remove an entry from the Caddyfile
 */
export function removeCaddyEntry(project, env = process.env) {
  if (BYPASS_CADDY) return;

  const { slug } = project;
  const host = `${slug}.${env.WEB_EDITOR_APPS_HOSTNAME}`;
  const re = new RegExp(`\\n${host}\\s*\\{[\\w\\W]+?\\n\\}\\n`, `gm`);
  const data = readFileSync(caddyFile).toString().replace(re, ``);
  writeFileSync(caddyFile, data);
  spawn(`caddy reload --config ${caddyFile}`, {
    shell: true,
    // stdio: `inherit`,
  });
  delete portBindings[slug];
}

/**
 * Create (or reset) our Caddyfile
 */
export function setupCaddy(env = process.env) {
  if (BYPASS_CADDY) return;

  const config = readFileSync(defaultCaddyFile)
    .toString()
    .replaceAll(`$WEB_EDITOR_HOSTNAME`, env.WEB_EDITOR_HOSTNAME)
    .replaceAll(`$WEB_EDITOR_APPS_HOSTNAME`, env.WEB_EDITOR_APPS_HOSTNAME)
    .replaceAll(`$WEB_EDITOR_APP_SECRET`, env.WEB_EDITOR_APP_SECRET)
    .replaceAll(`$TLS_DNS_PROVIDER`, env.TLS_DNS_PROVIDER)
    .replaceAll(`$TLS_DNS_API_KEY`, env.TLS_DNS_API_KEY)
    .replace(/\ttls[\s\r\n]*{[\s\r\n]*dns false false[\s\r\n]*}\n/m, ``);
  writeFileSync(caddyFile, config);
}

/**
 * Ensure a local Caddyfile exists for us to work with
 */
export function startCaddy() {
  if (BYPASS_CADDY) return;

  stopCaddy();

  const DEBUG = readFileSync(caddyFile)
    .toString()
    .match(/{[\s\r\n]*debug[\s\r\n]*}/);

  spawn(`caddy start --config ${caddyFile}`, {
    shell: true,
    stdio: DEBUG ? `inherit` : `ignore`,
  });
}

/**
 * Stop caddy.
 */
export function stopCaddy() {
  // TODO: this should honestly run until there's no caddy process left
  // in the process list, but that needs to happen in a cross-platform,
  // dependeny-cless way.
  // https://github.com/Pomax/make-webbly-things/issues/106
  try {
    execSync(`caddy stop`, { shell: true, stdio: `inherit` });
    execSync(`caddy stop`, { shell: true, stdio: `inherit` });
    execSync(`caddy stop`, { shell: true, stdio: `inherit` });
    execSync(`caddy stop`, { shell: true, stdio: `inherit` });
    execSync(`caddy stop`, { shell: true, stdio: `inherit` });
  } catch (e) {}
}

// When someone ctrl-c's a running instance, stop caddy (a few times) first.
process.on("SIGINT", () => {
  stopCaddy();
  process.exit();
});

/**
 * Set  up a binding for a named project
 * @param {*} name
 * @param {*} port
 */
export function updateCaddyFile(project, port, env = process.env) {
  if (BYPASS_CADDY) return;

  const { slug } = project;

  portBindings[slug] ??= new PortBinding(port);
  const binding = portBindings[slug];
  const data = readFileSync(caddyFile).toString();
  const host = `\n${slug}.${env.WEB_EDITOR_APPS_HOSTNAME}`;
  const index = data.indexOf(host);

  // Update the binding
  if (index >= 0) {
    const mark = `reverse_proxy localhost:`;
    const pos = data.indexOf(mark, index);
    if (pos !== -1) {
      const prefix = data.substring(0, pos);
      const suffix = data.substring(pos).replace(/:\d+/, `:${port}`);
      writeFileSync(caddyFile, prefix + suffix);
    }
  }

  // Create a new binding
  else {
    const { TLS_DNS_PROVIDER, TLS_DNS_API_KEY } = env;
    const tls =
      !TLS_DNS_API_KEY || TLS_DNS_API_KEY === `false`
        ? ``
        : `
\ttls {
\t\tdns ${TLS_DNS_PROVIDER} ${TLS_DNS_API_KEY}
\t}`;

    const entry = `
${host} {
\treverse_proxy localhost:${port}${tls}
\timport proxy_error_handling
}
`;

    writeFileSync(caddyFile, data + entry);
  }

  spawn(`caddy reload --config ${caddyFile}`, {
    shell: true,
    stdio: `ignore`,
  });

  scheduleScreenShot(project);

  return binding;
}
