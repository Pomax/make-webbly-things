/**
 * This a list that gets used as fallback when a project
 * doesn't specify which file should open by default.
 * The code will simply go down the list until it finds
 * a hit in the file tree, and then opens that
 */
export const DEFAULT_FILES = [
  `README.md`,
  `index.html`,
  `server.js`,
  `index.js`,
  `main.py`,
];
