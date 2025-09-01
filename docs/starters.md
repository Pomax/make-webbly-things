# Creating a starter project

- create a folder in `./content/__starter_projects`
- create a `.container` folder with a `settings.json` file, with the following fields:
  - `description` the short text description for the starter
  - `run_script` whatever needs to run for the starter to do its work. Have a look at other starters for inspiration
  - `default_file` (optional) the file that should automatically get shown when the project loads
  - `default_collapse` (optional) any folders that should automatically be shown "closed" like `node_modules`, `packages`, `vendor`, etc.
  - `app_type` if this project consists of static (or generated static) content, `"static"`. If it needs a persistent running process, `"docker"`.
  - `root_dir` (optional) if this is a generated static project, set this to the folder that the static generator builds into.

If your stater requires any special install instructions, remember to make that happen in the run script. For example, if it's a Node project that has dependencies, make sure your project has a `package.json` file, and an `npm install` instruction in your run script.

To see if your project does the right thing, run `node setup`, which will update the database based on your settings.json, after which you can remix the project on the main page (as long as you're logged in).
