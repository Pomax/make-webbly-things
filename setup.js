import * as Utils from "./src/setup/utils.js";

// Make sure we've updated process.env
Utils.parseEnvironment();

// Are we on the right version of Node?
Utils.checkNodeVersion();

// If we are, make sure the dependencies are installed
Utils.runNpmInstall;

// And then run the setup script.
import("./src/setup/index.js").then(({ runSetup }) => runSetup());
