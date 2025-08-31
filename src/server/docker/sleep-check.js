import { getProject } from "../database/project.js";
import { getAllRunningContainers, stopContainer } from "./docker-helpers.js";

const { max } = Math;
const msPerMinute = 60000;
const thresholdMinutes = 5;
const threshold = thresholdMinutes * msPerMinute;

const tzo = new Date().getTimezoneOffset();
const tzp = 100 * (tzo / 60) + (tzo % 60);
const TZ = `${tzo > 0 ? `-` : `+`}${`${tzp}`.padStart(4, `0`)}`;

function date(offset = 0) {
  const d = new Date(Date.now() + offset).toISOString();
  return d.replace(`T`, ` `).replace(`Z`, ``).replace(/\.\d+/, ``);
}

/**
 * Periodically check whether there are any docker containers running
 * that can be "safely" put to sleep because they haven't been edited
 * or requested for a while.
 */
export function scheduleContainerCheck() {
  console.log(
    `[${date()}] Checking to see if any containers need to be put to sleep.`
  );

  getAllRunningContainers().forEach(({ image, createdAt }) => {
    let p;
    try {
      p = getProject(image);
    } catch (e) {
      // orphaned image? O_o
      return stopContainer(image);
    }

    // Only stop a container if it's both "old enough" *and* the last edit
    // to the project is old enough. Because a container could be a week
    // old but if it's last update was 60 seconds ago, keep it alive.
    const created = Date.parse(createdAt);
    const lastUpdate = Date.parse(p.updated_at + ` +0000`);
    const diff = ((Date.now() - max(created, lastUpdate))/ msPerMinute) | 0;
    if (diff > thresholdMinutes) {
      console.log(
        `[${date()}] ${image} was last touched ${diff} minutes ago, stopping container.`
      );
      stopContainer(image);
    }
  });

  console.log(`[${date()}] Scheduling next container sleep check for ${date(threshold)}`);
  setTimeout(scheduleContainerCheck, threshold);
}
