import { sep } from "node:path";
import { getFreePort } from "../../helpers.js";
import { exec, execSync } from "child_process";
import {
  portBindings,
  removeCaddyEntry,
  updateCaddyFile,
} from "../caddy/caddy.js";
import { getProjectEnvironmentVariables } from "../database/index.js";

/**
 * ...docs go here...
 */
export function checkContainerHealth(projectName) {
  const check = `docker ps --no-trunc -f name=^/${projectName}$`;
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
    return `ready`;
  }
}

/**
 * ...docs go here...
 */
export function deleteContainer(name) {
  try {
    execSync(`docker container rm ${name}`);
  } catch (e) {
    // failure just means it's already been removed.
  }
  try {
    execSync(`docker image rm ${name}`);
  } catch (e) {
    // idem dito
  }
}

/**
 * ...docs go here...
 */
export function deleteContainerAndImage(name) {
  console.log(`removing container and image...`);
  stopContainer(name);
  deleteContainer(name);
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
      })
    );
    const { image, command, state, iD: id, status, size } = obj;
    containerData.push({ image, id, command, state, status, size });
  });
  return containerData;
}

/**
 * ...docs go here...
 */
export function getAllRunningStaticServers() {
  return Object.entries(portBindings)
    .map(([name, props]) => {
      const { port, process } = props;
      if (!process) return false;
      return { name, port };
    })
    .filter(Boolean);
}

/**
 * ...docs go here...
 */
export function renameContainer(oldName, newName) {
  stopContainer(oldName);
  try {
    execSync(`docker tag ${oldName} ${newName}`);
    execSync(`docker rmi ${oldName}`);
  } catch (e) {}
  runContainer(newName);
}

/**
 * ...docs go here...
 */
export async function restartContainer(name, rebuild = false) {
  if (rebuild) {
    console.log(`rebuiling container for ${name}...`);
    deleteContainerAndImage(name);
    await runContainer(name);
  } else {
    console.log(`restarting container for ${name}...`);
    try {
      execSync(`docker container restart -t 0 ${name}`);
    } catch (e) {
      // if an admin force-stops this container, we can't "restart".
      runContainer(name);
    }
  }
  console.log(`...done!`);
}

/**
 * Run a static server for a static project, since we don't
 * need a docker container for that, just an isolated server
 * running on its own port, with content security.
 *
 * FIXME: this function doesn't feel like it should live here...
 */
export async function runStaticSite(projectName) {
  const port = await getFreePort();
  console.log(
    `attempting to run static server for ${projectName} on port ${port}`
  );
  const runCommand = `node src/server/static.js --project ${projectName} --port ${port}`;
  console.log(runCommand);
  const child = exec(runCommand, { shell: true, stdio: `inherit` });
  const binding = updateCaddyFile(projectName, port);
  binding.process = child;
}

/**
 * ...docs go here...
 */
export async function runContainer(projectName) {
  // note: we assume the caller already checked for project
  // suspension, so we don't try to use the database here.

  console.log(`attempting to run container ${projectName}`);
  let port = await getFreePort();

  // Do we have a container? If not, build one.
  console.log(`- Checking for image`);
  let result = execSync(`docker image list`).toString().trim();

  if (!result.match(new RegExp(`\\b${projectName}\\b`, `gm`))) {
    console.log(`- Building image`);
    try {
      execSync(`docker build --tag ${projectName} --no-cache .`, {
        shell: true,
        stdio: `inherit`,
      });
    } catch (e) {
      return console.error(e);
    }
  }

  // FIXME: TODO: check if `docker ps -a` has a dead container that we need to cleanup

  console.log(`- Checking for running container`);
  const check = `docker ps --no-trunc -f name=^/${projectName}$`;
  result = execSync(check).toString().trim();

  if (!result.match(new RegExp(`\\b${projectName}\\b`, `gm`))) {
    console.log(`- Starting container on port ${port}`);
    const runFlags = `--rm --stop-timeout 0 --name ${projectName}`;
    const bindMount = `--mount type=bind,src=.${sep}content${sep}${projectName},dst=/app`;
    const envVars = Object.entries(getProjectEnvironmentVariables(projectName))
      .map(([k, v]) => `-e ${k}="${v}"`)
      .join(` `);
    const entry = `/bin/sh .container/run.sh`;
    const runCommand = `docker run ${runFlags} ${bindMount} -p ${port}:8000 ${envVars} ${projectName} ${entry}`;
    console.log(runCommand);
    exec(runCommand);
  }

  // FIXME: TODO: it would be nice if we could just "check until we know" rather than
  //              using a 2 second timeout to see what the actual port is. Because
  //              despite all logic, I've seen docker pick a *different* port than
  //              the one the run command instructs it to use O_o
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

  updateCaddyFile(projectName, port);

  return `success`;
}

/**
 * ...docs go here...
 */
export function stopContainer(name) {
  try {
    execSync(`docker container stop ${name}`);
  } catch (e) {
    // failure just means it's already no longer running.
  }
  removeCaddyEntry(name);
}

/**
 * ...docs go here...
 */
export function stopStaticServer(name) {
  portBindings[name].process?.kill();
  removeCaddyEntry(name);
}
