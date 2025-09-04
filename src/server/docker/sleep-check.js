import { getProject } from "../database/project.js";
import { getAllRunningContainers, stopContainer } from "./docker-helpers.js";
const { max } = Math;

const msPerMinute = 60000;
const runInterval = 5 * msPerMinute;

// static projects get 5 minutes:
const staticThreshold = 5;

// docker projects get a day:
const dockerThreshold = 24 * 60;

// For how long since an edit occurred
// should we start a project as a docker
// project, regardless of app_type?
export const dockerDueToEdit = 5;

// date formatting helper
function date(offset = 0) {
  const d = new Date(Date.now() + offset).toISOString();
  return d.replace(`T`, ` `).replace(`Z`, ``).replace(/\.\d+/, ``);
}

// logging helper
function log(msg) {
  console.log(`[${date()}] ${msg}.`);
}

// helper function for getting a project
function project(slug) {
  try {
    const p = getProject(slug);
    return {
      updated_at: p.updated_at,
      app_type: p.settings.app_type,
    };
  } catch (e) {
    // orphaned image? O_o
    stopContainer(image);
  }
}

/**
 * Get the timing difference between "now" and a given timestamp, in minutes
 */
export function getTimingDiffInMinutes(timestamp) {
  return ((Date.now() - timestamp) / msPerMinute) | 0;
}

/**
 * Periodically check whether there are any docker containers running
 * that can be "safely" put to sleep because they haven't been edited
 * or requested for a while.
 */
export function scheduleContainerCheck() {
  log(`Checking to see if any containers need to be put to sleep`);

  getAllRunningContainers().forEach(({ image, createdAt, p: d }) => {
    if (!(d = project(image))) return;

    const created = Date.parse(createdAt);
    const lastUpdate = Date.parse(d.updated_at + ` +0000`);
    const diff = getTimingDiffInMinutes(max(created, lastUpdate));

    // Only stop a container if it's both "old enough" *and* the last edit
    // to the project is old enough. Because a container could be a week
    // old but if it's last update was 60 seconds ago, keep it alive.

    const limit = d.app_type === `docker` ? dockerThreshold : staticThreshold;
    if (diff > limit) {
      log(`"${image}" was last touched ${diff} min ago, stopping container`);
      stopContainer(image);
    }
  });

  log(`Scheduling next container sleep check for ${date(runInterval)}`);
  setTimeout(scheduleContainerCheck, runInterval);
}
