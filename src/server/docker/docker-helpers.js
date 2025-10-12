import { sep } from "node:path";
import { getFreePort } from "../../helpers.js";
import { exec, execSync } from "child_process";
import {
  portBindings,
  removeCaddyEntry,
  updateCaddyFile,
} from "../caddy/caddy.js";
import { getProjectEnvironmentVariables } from "../database/index.js";
import { scheduleScreenShot } from "../screenshots/screenshot.js";

/**
 * ...docs go here...
 */
export function checkContainerHealth(project, slug = project.slug) {
  const check = `docker ps --no-trunc -f name=^/${slug}$`;
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
  try {
    execSync(`docker container rm ${slug}`, { stdio: `ignore` });
  } catch (e) {
    // failure just means it's already been removed.
  }
  try {
    execSync(`docker image rm ${slug}`, { stdio: `ignore` });
  } catch (e) {
    // idem dito
  }
}

/**
 * ...docs go here...
 */
export function deleteContainerAndImage(project) {
  console.log(`removing container and image...`);
  stopContainer(project);
  deleteContainer(project);
}

/**
 * ...docs go here...
 */
export function getAllRunningContainers() {
  const containerData = [];
  const output = execSync(`docker ps -a --no-trunc --format json`)
    .toString()
    .split(`\n`);
  output.forEach((line) => {
    if (!line.trim()) return;
    let obj = JSON.parse(line);
    obj = Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        return [k[0].toLowerCase() + k.substring(1), v];
      }),
    );
    const { image, command, state, iD: id, status, size, createdAt } = obj;
    containerData.push({ image, id, command, state, status, size, createdAt });
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
 * ...docs go here...
 */
export function renameContainer(oldSlug, newSlug) {
  stopContainer(oldSlug);
  try {
    execSync(`docker tag ${oldSlug} ${newSlug}`);
    execSync(`docker rmi ${oldSlug}`);
  } catch (e) {}
}

/**
 * ...docs go here...
 */
export async function restartContainer(project, rebuild = false) {
  const { slug } = project;
  if (rebuild) {
    console.log(`rebuilding container for ${slug}...`);
    deleteContainerAndImage(project);
    await runContainer(project);
  } else {
    console.log(`restarting container for ${slug}...`);
    try {
      execSync(`docker container restart -t 0 ${slug}`);
      portBindings[slug].restarts ??= 0;
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
  // note: we assume the caller already checked for project
  // suspension, so we don't try to use the database here.

  console.log(`attempting to run container ${slug}`);
  let port = await getFreePort();

  // Do we have a container? If not, build one.
  console.log(`- Checking for image`);
  let result = execSync(`docker image list`).toString().trim();

  if (!result.match(new RegExp(`\\b${slug}\\b`, `gm`))) {
    console.log(`- Building image`);
    try {
      execSync(`docker build --tag ${slug} --no-cache .`, {
        shell: true,
        stdio: `inherit`,
      });
    } catch (e) {
      return console.error(e);
    }
  }

  // FIXME: TODO: check if `docker ps -a` has a dead container that we need to cleanup. https://github.com/Pomax/make-webbly-things/issues/109

  console.log(`- Checking for running container`);
  const check = `docker ps --no-trunc -f name=^/${slug}$`;
  result = execSync(check).toString().trim();

  if (!result.match(new RegExp(`\\b${slug}\\b`, `gm`))) {
    console.log(`- Starting container on port ${port}`);
    const runFlags = `--rm --stop-timeout 0 --name ${slug}`;
    const bindMount = `--mount type=bind,src=.${sep}content${sep}${slug},dst=/app`;
    const envVars = Object.entries(getProjectEnvironmentVariables(project))
      .map(([k, v]) => `-e ${k}="${v}"`)
      .join(` `);
    const entry = `/bin/sh .container/run.sh`;
    const runCommand = `docker run ${runFlags} ${bindMount} -p ${port}:8000 ${envVars} ${slug} ${entry}`;
    console.log(runCommand);
    exec(runCommand);
  }

  // FIXME: TODO: it would be nice if we could just "check until we know" rather than
  //              using a 2 second timeout to see what the actual port is. Because
  //              despite all logic, I've seen docker pick a *different* port than
  //              the one the run command instructs it to use O_o
  //              https://github.com/Pomax/make-webbly-things/issues/100
  await new Promise((resolve) => {
    setTimeout(() => {
      result = execSync(check).toString().trim();
      resolve();
    }, 2000);
  });

  try {
    port = result.match(/0.0.0.0:(\d+)->/m)[1];
    console.log(`- found a running container on port ${port}`);
  } catch (e) {
    console.log(`could not get the port from docker...`);
  }

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
  const runCommand = `node src/server/static.js --project ${slug} --port ${port} --root "${root}"`;
  console.log(runCommand);
  const child = exec(runCommand, { shell: true, stdio: `inherit` });
  const binding = updateCaddyFile(project, port);
  binding.serverProcess = child;
}

/**
 * ...docs go here...
 */
export function stopContainer(project, slug = project.slug) {
  try {
    execSync(`docker container stop ${slug}`);
  } catch (e) {
    // failure just means it's already no longer running.
  }
  removeCaddyEntry(project);
}

/**
 * ...docs go here...
 */
export function stopStaticServer(project, slug = project.slug) {
  const { serverProcess } = portBindings[slug] ?? {};
  if (serverProcess) {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${serverProcess.pid} /f /t`);
    } else {
      serverProcess.kill(`SIGINT`);
    }
    removeCaddyEntry(project);
  }
}
