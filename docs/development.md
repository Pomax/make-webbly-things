# Working on the platform

This platform's codebase is split up into several sections:

- `./content` houses the user projects, as well as the special `__starter_projects` folder, and the `default` folder that is used to show some content while a project container is still loading.
- `./data` houses the sqlite databases (both the platform itself and the session db) and sql schema
- `./docs` houses the platform's documentation
- `./public` houses all the content that the platform's own server can **_statically_** serve. It does not have any "html pages", those are found in `src/server/pages`

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

The routing code is split up into three disctinc parts, each with their own roles:

### endpoints

Endpoints are route-servicing code that set up GET or POST responses, and whose only job is to says which route they're servicing, and which series of operations need to be performed in order to form a response. Endpoint code should not be "doing" anything itself.

### Middleware

Middleware is responsible for taking care of one step in a multi step process. For example, if someone needs to edit a file in their project, "confirming they are logged in", "getting the project", and "applying a file update" are all separate steps, each with their own middleware function that either call `next` after doing what they need to do, or calling `next` with an Error object if something went wrong.

### Functional code

Middleware might need to load a project, but the way it does that is by first making sure that that all preconditions are met, and then calling "whatever is responsible for project code". In this specific example, that's the `database/project.js` code. 

So putting it all together: the endpoints define which steps must complete in order to form a response to a URL call, middleware is responsible for meeting each step, which it does by making sure all preconditions are met to run "The real code", which is found in their own files. 

This also means there are three stages of testing: endpoint testing, to see if URL calls lead to expected responses, middleware tests, to see if providing specific req/res combinations lead to the expected behaviour, and functional tests, which simply check that "norma" code functions do what they're supposed to.

## Testing

Testing uses the built in Node test framework. Just run `node test` and it'll will run through every test in the `src/tests` folder. Note that every file in the `src` dir has a corresponding `test.js` file in the `src/tests` folder: if you're making new files, remember to also write new tests =D

Note that tests will throw a lot of errors about not being able to `cd` or write files: that's expected, the test suite simply doesn't suppress any stdout/stderr while running, so errors that are _supposed_ to happen in the code, but aren't a test failure, will still end up writing error text to the console.

Just wait for it to finish, and then _then_ see if there are any real errors: they'll be mentioned after the coverage table.

The one issue, thanks to Docker being Docker, is that it's possible for certain fetch operations to Docker containers to error out. Typically rerunning the test suite makes those disappear.
