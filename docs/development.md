# Working on the platform

This platform's codebase is split up into several sections:

- `./content` houses the user projects, as well as the special `__starter_projects` folder, and the `default` folder that is used to show some content while a project container is still loading.
- `./data` houses the sqlite databases (both the platform itself and the session db) and sql schema
- `./docs` houses the platform's documentation
- `./public` houses all the content that the platform's own server can **_statically_** serve. It does not have any "html pages", those are found in `src/server/pages`

Note that there are a few special content folders:

- `./content/__archives` is used as a transient location for project downloads.
- `./content/__screenshots` is where project screenshots are stored for showing project cards on the main page as well as a user's profile page.
- `./content/__starter_projects` houses all the starter projects offered by the platform.

All the "code" lives inside the `src` folder:

- `./src` houses the platform's client and server code
- `./src/client` houses all the JS that constitutes the browser-based editor code.
- `./src/server` houses all the code that is involved in running the platform itself

The server code is further split up into the following logical folders:

- `./src/server/caddy` is where the Caddy code and configs live
- `./src/server/database` is where the JS that deals with database interaction lives
- `./src/server/docker` is where the Docker code and base configs live
- `./src/server/pages` is where all the nunjucks-templated HTML lives, with fragments in the `fragments` subfolder
- `./src/server/routing` is where all the server route information can be found. If it has a URL, resolution for that URL can be found here.

## End points vs. middleware vs. functionality

The request handling code is structured as three different levels of abstraction, following the standard Express.js methodology:

### endpoints

Endpoints are written as route-servicing code that receive GET or POST requests and then form responses for those. This code's only job is to says which route is being serviced, using what HTTP verb, and which series of operations will need to be performed in order for a response to be sent back.

Endpoint code should never be "doing" anything itself, except for sending the final response (which could be any kind of data)

### Middleware

Middleware is responsible for taking care of one step in a multi step process. For example, if someone needs to edit a file in their project, "confirming they are logged in", "getting the project", and "applying a file update" are all separate steps, each with their own middleware function that either call `next` after doing what they need to do, or calling `next` with an Error object if something went wrong.

### Functional code

Middleware might need to load a project, but the way it does that is by first making sure that that all preconditions are met, and then calling "whatever is responsible for project code". In this specific example, that's the `database/project.js` code.

So putting it all together: the endpoints define which steps must complete in order to form a response to a URL call, middleware is responsible for taking the request and response, and forming the arguments that it will need in order to run the "real code" (or not call the real code if the call preconditions can't be met). The real code, finally, is "just code". It's not specific to web servers or route handling, it's just normal code that does a thing.

This also means there are three stages of testing: endpoint testing, to see if URL requests lead to expected responses; middleware tests, to see if providing specific req/res combinations lead to the expected behaviour; and functional tests, which simply check that plain code functions do what they're supposed to.

## Testing

Testing uses the built in Node test framework. Just run `npm test` and it'll will run through bothc code auto-formatting, a client build, and then the full battery of tests found in the `src/tests` folder. Note that every file in the `src` dir has a corresponding `test.js` file in the `src/tests` folder: if you're making new files, remember to also write new tests =D

Note that tests will throw a lot of unstyled errors about not being able to `cd` or write files: that's expected, the test suite simply doesn't suppress any stdout/stderr while running, so errors that are _supposed_ to happen in the code in order for a test to pass will still end up writing error text to the console. Just wait for it to finish, and then _then_ see if there are any real errors: they'll be mentioned after the coverage table.

The one issue that you are likely to (frequently) run into, thanks to Docker being Docker, is that it's possible for certain fetch operations to Docker containers to error out. For now, rerunning the test suite generally makes those disappear, but if we can find every test for which that happens, we can wrap each failing `fetch` in a `tryFor(...)` call, which will retry the fetch for a few seconds before it gives up, and a few seconds is more than enough for it to succeed.

### Testing with parts disabled

#### Bypassing login

You can run the platform with `npm start -- --admin-mode` (note the extra `--`, which forwards everything after it "to the thing npm is calling" rather than "to the npm command itself") to automatically bypass the login procedure and have the platform treat every request as authenticated by user 1, which (unless you did something funky) is going to be the admin account.

#### Bypassing certain dependencies

You can run the system with dependencies bypassed by setting `BYPASS_DEPENDENCIES=1` as part of your run. This will bypass both Docker and Caddy checks, which is usually too much, so you can also use either `BYPASS_DOCKER=1` or `BYPASS_CADDY=1` to only bypass docker or caddy.

For normal testing, bypassing caddy is generally not necessary, but bypassing docker makes a lot of sense as Docker will happily drain a laptop battery. When bypassing Docker, any project that is explicitly a `docker` project will not be able to fire up their docker image of course, but `static` projects will still run, just as their static server version rather than as docker image.

### CI testing in Pull Requests

When filing a PR on GitHub, your code will automatically be checked using a GitHub Action that runs `npm test`, which runs code formatting, linting, and the full test suite. This is not always necessary, and so when filing a PR you have the option to add the `bypass-ci` label. If you do, none of the usual testing will run before your PR is allowed to be merged. There is almost never a reason to do this for actual code changes (not even if it's just a single typo fix), however if your PR is a documentation PR that simply changes text in any of the Markdown files used in this repository, or it simply updates `...docs go here...` code comment sections, then there is no reason to run the test suite and using `bypass-ci` makes total sense.

## How do I update docker containers if I update the codebase?

To generate a new docker base image after updating the codebase, you can run:

```
node setup --clean
```

This will leave any running containers alone, but clean up any "dead" containers based on the old image, then generates a new local base image, after which any project container that gets built will use the new image instead. So if you need to "force people to update" you can run the `--clean` pass, then go into the admin page, stop all containers, and then whenever people try to load their site, that'll trigger an updated container build. Handy!
