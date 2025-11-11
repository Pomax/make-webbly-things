# What can we do on this platform?

First off, there are four classes of users:

1. anonymous visitors
2. registered users, pending activation
3. registered, activated users
4. admins

Each can do "the same as the previous class", plus their own actions.

## Anonymous users

As an anonymous visitor, you can...

- Load the landing page (obviously =D),
- Sign up by picking a user name and primary authentication method (but note that signing in doesn't actually give you a "working" account, you first need to be approved by an admin), and
- Load projects in the editor and see the code and site preview, including starter projects shown on the landing page.

You won't be able to edit any code, but you can look at all every file that is visiable to not-project-members, and you can see the resulting site running in the "preview" (which is of course not a preview at all, that's just literally the live site).

## registered users

As a registered user whose account has not yet been activated, you can do the same things as an anonymous visitors, but also

- Download projects when you're in the editor. This will let you download the public files as a convenient .zip file.
- Add additional auth providers so you won't be locked out of your account if you lose access to the primary provider you picked when you signed up.
- Log in using any of your chosen providers, which will "land" you on your personal page. Although the only thing that'll let you do is log out, or open your profile page.
- Generate "direct login links" so you can log yourself in on other devices by sending yourself a link (these are single-use links that expire after 12 hours).
- Edit your profile in terms of your bio (which you can write using markdown) and the links you want people to see (like your homepage, github profile url, mastodon account, etc. etc)

## registered, activated user

As a signed in and approved user you can do everything the platform was meant for:

- Log in and land on a "fully qualified" personal landing page, letting you start new projects as well as showing your list of projects.
- Start new projects by remixing a starter project on your landing page.
- Load any project in the editor (yours or other folks'). Just like visitors, you can't edit any projects that you're not a member of, but just like unactivated users you get a download link that lets you download the entire project (without members-only data) as a zip file in case you want to review or remix it off-platform.
- You can load your own projects in the editor with full edit rights:
  - you can edit project settings, including the project run script and its environment variables, as well as specify whether it's a static project (e.g. in only needs a static server pointed at a root dir in production) or a persistent project that needs a full-fat Ubuntu container to always be running in order to serve content.
  - you can edit project files, including auto-formatting them if they're file types that are recognized by `prettier` (for html/css/js) or `black` (for python).
  - you can create a folder called `.data` that counts as the only safe place to put private project data (This folder will not be copied over when someone remixes your project).
  - you can view the server logs for persistent process projects.
  - you can download your project as zip file with both public and private data included.
  - you can force-restart your project's docker container, which is useful for when it gets stuck, or when you're running a project that doesn't auto-reload things when you change source files.
- Remix projects, using the remix link. This creates a new copy of the public code parts with either a name you pick, or "yourusername-projectname" (so you'll probably want to rename it afterwards!). Note that you can remix _any_ project, so that includes your own!

## admins

As an admin, you can do everything a regular user can do, but also...

- You get access to the admin page, which lets you:
  - see a list of users, with options to enable/disable, (un)suspend, and delete their accounts.
  - see a list of projects, with options to (un)suspend, and delete projects
  - see a list of active docker containers, with options to stop or remove them
  - see a list of active static servers, with an option to stop them.

You are also able to load suspended projects in the editor, so you can see what a project does without "running" it, and inspect and edit other folk's project settings.

Finally, as admin you toggle your `superuser` flag, which lets you perform things like editing files in any user's projects, including updating project settings.
