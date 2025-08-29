import { API } from "./api.js";

export const noop = () => {};

/**
 * nicer than always typing document.createElement
 */
export function create(tag) {
  return document.createElement(tag);
}

/**
 * helper function for getting file text content:
 */
export async function fetchFileContents(
  projectName,
  fileName,
  type = `text/plain`
) {
  const response = await API.files.get(projectName, fileName);
  if (type.startsWith(`text`) || type.startsWith(`application`))
    return response.text();
  return response.arrayBuffer();
}

/**
 * A very dumb digest function that just sums the
 * bytes in a file. We don't care about collision, we just
 * care that it's good enough to signal that two files that
 * should be the same, are somehow not the same.
 */
export function getFileSum(data) {
  const enc = new TextEncoder();
  return enc.encode(data).reduce((t, e) => t + e, 0);
}

/**
 * simple array-like comparison
 * @returns
 */
export function listEquals(a1, a2) {
  if (a1.length !== a2.length) return false;
  return a1.every((v, i) => a2[i] === v);
}
