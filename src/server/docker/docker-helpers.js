import { sep } from "node:path";
import {
  BYPASS_DOCKER,
  CONTENT_BASE,
  DOCKER,
  getFreePort,
  STARTER_BASE,
  TESTING,
} from "../../helpers.js";
import { exec, execSync } from "node:child_process";
import {
  portBindings,
  removeCaddyEntry,
  updateCaddyFile,
} from "../caddy/caddy.js";
import {
  getProjectEnvironmentVariables,
  isStarterProject,
} from "../database/index.js";
import { scheduleScreenShot } from "../screenshots/screenshot.js";

/**
 * ...docs go here...
 */
export function checkContainerHealth(project, slug = project.slug) {
  if (BYPASS_DOCKER) return `not running`;

  const check = `${DOCKER} ps --no-trunc -f name=^/${slug}$`;
  const result = execSync(check).toString().trim();
  if (result.includes(`Exited`)) {
    return `failed`;
  }
  if (!result.includes`0.0.0.0`) {
    return `not running`;
  }
  if (result.includes(`starting`)) {
    return `wait`;
  }
  if (result.includes(`(healthy)`)) {
    scheduleScreenShot(project);
    return `ready`;
  }
}

/**
 * ...docs go here...
 */
export function deleteContainer(project, slug = project.slug) {
  if (BYPASS_DOCKER) return;

  try {
    execSync(`${DOCKER} container rm ${slug}`, { stdio: `ignore` });
  } catch (e) {
    // failure just means it's already been removed.
  }
  try {
    execSync(`${DOCKER} image rm ${slug}`, { stdio: `ignore` });
  } catch (e) {
    // idem dito
  }
}

/**
 * ...docs go here...
 */
export function deleteContainerAndImage(project) {
  if (BYPASS_DOCKER) return;

  console.log(`removing container and image...`);
  stopContainer(project);
  deleteContainer(project);
}

/**
 * Smooth over a docker/podman difference.
 */
export function parseDockerJSON(data) {
  let containerData = [];

  // Docker doesn't actually generate JSON, it
  // generates "one JSON object per line" output...
  if (DOCKER === `docker`) {
    data.split(`\n`).forEach((line) => {
      if (!line.trim()) return;
      const obj = JSON.parse(line);
      containerData.push(obj);
    });
  } else {
    // not-docker, which right now is just
    // Podman, generates actual JSON.
    containerData = JSON.parse(data);
  }

  containerData.forEach((obj) =>
    Object.keys(obj).forEach((k) => {
      let key = k[0].toLowerCase() + k.substring(1);
      if (k.length === 2) key = k.toLowerCase();
      obj[key] = obj[k];
      delete obj[k];
    }),
  );

  return containerData;
}

/**
 * ...docs go here...
 */
export function getAllRunningContainers() {
  if (BYPASS_DOCKER) return [];

  let containerData = parseDockerJSON(
    execSync(`${DOCKER} ps -a --no-trunc --format json`).toString(),
  );

  // Now that we know we have the same data irrespective of the
  // source, get the values that we need out of each entry.
  containerData = containerData.map((obj) => {
    const { command, createdAt, id, image, size, state, status } = obj;
    return { command, createdAt, id, image, size, state, status };
  });

  return containerData;
}

/**
 * ...docs go here...
 */
export function getAllRunningStaticServers() {
  return Object.entries(portBindings)
    .map(([name, props]) => {
      const { port, serverProcess } = props;
      if (!serverProcess) return false;
      return { name, port };
    })
    .filter(Boolean);
}

/**
 * Get a container's log ouput, optionally "since some specific time"
 */
export function getContainerLogs(project, since = 0) {
  if (BYPASS_DOCKER) return false;
  const { slug } = project;
  const cmd = `${DOCKER} container logs --since ${since} ${slug}`;
  try {
    const output = execSync(cmd).toString();
    // And now for the stupid part:
    const datetime = execSync(cmd.replace(`--since`, `-t --since`))
      .toString()
      .split(`\n`)
      .at(-2)
      .replace(/Z.*/, `Z`);
    return { output, datetime };
  } catch {
    return false;
  }
}

/**
 * ...docs go here...
 */
export function renameContainer(oldSlug, newSlug) {
  if (BYPASS_DOCKER) return;

  stopContainer(oldSlug);
  try {
    execSync(`${DOCKER} tag ${oldSlug} ${newSlug}`);
    execSync(`${DOCKER} rmi ${oldSlug}`);
  } catch (e) {}
}

/**
 * ...docs go here...
 */
export async function restartContainer(project, rebuild = false) {
  if (BYPASS_DOCKER) return;

  const { slug } = project;
  if (rebuild) {
    console.log(`rebuilding container for ${slug}...`);
    deleteContainerAndImage(project);
    await runContainer(project);
  } else {
    console.log(`restarting container for ${slug}...`);
    try {
      const command = `${DOCKER} container restart -t 0 ${slug}`;
      console.log({ command });
      execSync(command, { shell: true });
      portBindings[slug].restarts++;
    } catch (e) {
      // if an admin force-stops this container, we can't "restart".
      runContainer(project);
    }
  }
  console.log(`...done!`);
}

/**
 * ...docs go here...
 */
export async function runContainer(project, slug = project.slug) {
  if (BYPASS_DOCKER) {
    if (project.settings?.app_type === `static`) {
      runStaticServer(project);
    }
    return;
  }

  // note: we assume the caller already checked for project
  // suspension, so we don't try to use the database here.
  const isStarter = isStarterProject(project);

  console.log(`attempting to run container ${slug}`);
  let port = await getFreePort();

  // Do we have an image?
  console.log(`- Checking for image`);
  let result = execSync(`${DOCKER} image list`).toString().trim();
  const foundProject = () =>
    result.match(new RegExp(`(^|\\s)${slug}\\b`, `gm`));

  // If not, build one.
  if (!foundProject()) {
    console.log(`- Building image`);
    try {
      const build = `${DOCKER} build --tag ${slug} --no-cache .`;
      execSync(build);
    } catch (e) {
      return console.error(e);
    }
  }

  // We know there's an image now, but: is it running as container?

  // FIXME: TODO: check if `docker ps -a` has a dead container that we need to cleanup. https://github.com/Pomax/make-webbly-things/issues/109
  console.log(`- Checking for running container`);
  const check = `${DOCKER} ps --no-trunc -f name=^/${slug}$`;
  result = execSync(check).toString().trim();

  // There is no running container: start one
  if (!foundProject()) {
    console.log(`- Starting container on port ${port}`);
    const runFlags = `--detach --rm --stop-timeout 0 --name ${slug}`;
    const base = isStarter ? STARTER_BASE : CONTENT_BASE;
    const bindMount = `--mount type=bind,src=.${sep}${base}${sep}${slug},dst=/app`;
    const envVars = Object.entries(getProjectEnvironmentVariables(project))
      .map(([k, v]) => `-e ${k}="${v}"`)
      .join(` `);
    const entry = `/bin/sh .container/run.sh`;
    const runCommand = `${DOCKER} run ${runFlags} ${bindMount} -p ${port}:8000 ${envVars} ${slug} ${entry}`;
    if (TESTING) console.log({ runCommand });
    try {
      execSync(runCommand);
    } catch (e) {
      console.error(`Failed to run project!`, e);
    }
  }

  const updatePortBinding = async (retry = 1) => {
    if (retry > 10) {
      console.error(
        `Retried binding port for ${project.slug} too many times, giving up`,
      );
      return;
    }
    result = execSync(check).toString().trim();
    const runningPort = result.match(/0.0.0.0:(\d+)->/m)?.[1];
    if (runningPort) {
      console.log(`- found port from container: ${runningPort}`);
      return runningPort;
    }
    console.log(`- no network binding (yet), retrying in 500ms`);
    return new Promise((resolve) => {
      setTimeout(() => resolve(updatePortBinding(retry + 1)), 500);
    });
  };

  port = await updatePortBinding();
  updateCaddyFile(project, port);
  return `success`;
}

/**
 * Run a static server for a static project, since we don't
 * need a docker container for that, just an isolated server
 * running on its own port, with content security.
 *
 * FIXME: this function doesn't feel like it should live here...
 *        https://github.com/Pomax/make-webbly-things/issues/111
 */
export async function runStaticServer(project) {
  const { slug } = project;
  if (portBindings[slug]) return;
  const port = await getFreePort();
  console.log(`attempting to run static server for ${slug} on port ${port}`);
  const s = project.settings;
  const root = s.root_dir === null ? `` : s.root_dir;
  const isStarter = isStarterProject(project);
  const opts = [
    `--project ${slug}`,
    `--port ${port}`,
    `--root "${root}"`,
    isStarter ? `--starter` : ``,
    // This part exists solely because GitGub Actions don't
    // support kill, which is INSANE and means that we can't
    // just use serverPocess.kill() to gracefully shut down
    // server instances during tests inside gh actions.
    // So smart! Thanks GitHub!
    TESTING ? `--with-shutdown` : ``,
  ].join(` `);
  const runCommand = `node src/server/static.js ${opts}`;
  if (TESTING) console.log({ runCommand });
  const binding = updateCaddyFile(project, port);
  binding.serverProcess = exec(runCommand);
}

/**
 * ...docs go here...
 */
export function stopContainer(project, slug = project.slug) {
  if (BYPASS_DOCKER) {
    if (project.settings?.app_type === `static`) {
      stopStaticServer(project);
    }
    return;
  }

  try {
    execSync(`${DOCKER} container stop ${slug}`, { stdio: `ignore` });
  } catch (e) {
    // failure just means it's already no longer running.
  }
  removeCaddyEntry(project);
}

/**
 * ...docs go here...
 */
export function stopStaticServer(project, slug = project.slug) {
  const { port, serverProcess } = portBindings[slug] ?? {};
  if (serverProcess) {
    if (TESTING) {
      // This part exists solely because GitGub Actions don't
      // support kill, which is INSANE and means that we can't
      // just use serverPocess.kill() to gracefully shut down
      // server instances during tests inside gh actions.
      // So smart! Thanks GitHub!
      fetch(`http://localhost:${port}/shutdown`);
    } else {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${serverProcess.pid} /f /t`);
      } else {
        serverProcess.kill(`SIGINT`);
      }
    }
    removeCaddyEntry(project);
  }
}
