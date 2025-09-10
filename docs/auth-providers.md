# Adding authentication providers

The philosophy of this platform is that it should never need to know your email address or your favourite password: it can't leak what you don't give it.

As such, instead of traditional username/password or even "magic link" email logins, this platform allows you to sign up using third party authentication providers like GitHub, Google, or Mastodon, and encourages you to use more than one. After all, if you lose access to one of them, having two more means you're never locked out of your account here.

## Passport.js

In order to make adding authentication providers easier, this platform uses [passport.js](https://www.passportjs.org/), which is a general purpose authentication solution that, while older, supports and incredible number of different third party authentication strategies.

By default, the platform offers Github, Google, and Mastodon authentication, using the following strategy packages:

- https://github.com/cfsghost/passport-github
- https://github.com/jaredhanson/passport-google
- https://github.com/techfeed/passport-mastodon

You can see how these are used to implement authentication over in `src/server/routing/auth/index.js`

## User accounts and authentications

Users and their logins are stored separately in the database, where user accounts are stored in the `users` table, with a name, "url safe name", bio, etc, and third party login information is stored in the `user_logins` table, which simply encodes a tiplet `{user id, service name, user's id at that service}`, which is the only information the platform cares about: when you log in with Github, for example, the platform simply checks whether there is a `user_logins` entry for your user id, matching the github service, and checks to make sure that the current login attempt has the same id as it got when it created that record. 

So the actual "is the login good or not" isn't even handled by the platform: by the time it gets "called back" to finalize authentication, we already know that you were able to log into the third party service, and we just need to make sure we verify that the profile information we get is the correct information.

This means that one user account can have, in theory, as many login records as there are third party services (and you should encourage your users to use as many as apply to them, just so they're never locked out of their account!).

## Adding a new authentication service

- Install the relevant passport.js strategy package
- Add a new settings object, specific for the new service, to `src/server/routing/auth/settings.js` 
- Add the new service's name to the `validProviders` list at the bottom of that file, too.
- Update the `setup.js` file because your new service is going to need some new environment variables, which means those shouldn't need to be written by hand. Have a look at at `setupEnv` and how that uses/implements `setupGithubAuth` etc. and simply repeat that for your service.
- Test it! =D
- File a PR to [https://github.com/Pomax/make-webbly-things](https://github.com/Pomax/make-webbly-things) so that everyone else can choose whether or not to enable this new authentication service in their own instance!
