# How to install this platform's prerequisites

## (1) Node.js

You probably already know how to install Node.js, but if you don't, my recommendation would be:

- On Windows, install [nvm-windows](https://github.com/coreybutler/nvm-windows?tab=readme-ov-file#installation--upgrades) and then once that's installed, run `nvm install latest`, then `nvm use latest`. You should be good to go now.
- On MacOS or Linux, install [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating) and once that's set up, run `nvm install node`, then `nvm use node`. This will install and use the latest version of Node.

## (2) Git

We don't just need `git` for cloning the platform's own repo: it's also used to track changes that users make to projects in the `content` directory, so unlike most projects git is _actually_ a requirement.

- Windows and MacOS users will want to hit up https://git-scm.com and simply download the installer
- Linux users will have to use their OS's package manager to install the `git` package.

## (3) Docker

While project _content_ lives in the content directory on your computer (or your server, etc), you don't want it to _run_ in that context. That would give it access to.. well... everything, including other project's content, the editor's code, routing configs, etc. etc. So, instead, the runtime is handled by creating a Docker container (think virtual machine) running "Alpine" Linux with Node.js and Python preinstalled, with a project's content added in as a "bind mount" (meaning the files live on the host OS, but the docker container has read/write access to them).

Projects have a special `.container` dir that houses a `run.sh` file that acts as your "what happens when your project container starts up" instruction. Also, restarting a project doesn't actually "restart" it so much as stops the container, which removes the container, then it builds a new container with the new name (which is just a fast copy of the local base image) and then run that. So be aware that any data you write outside of the project's home directory (i.e. `~/app`) is, at best, temporary. The moment the project container has to restart for whatever reason, any changes outside your project directly will be lost.

- On MacOS, install `docker` and `colima` using your favourite package manager (I use `brew` but people have opinions about this so use whatever works for you). Just remember that you'll need to run `colima start` any time you start up your mac, because otherwise anything docker-related will crash out with super fun error messages.

- On Linux, you already know how to install Docker. You're using Linux. And even if you don't, you know how to look it up (...and you know it's either going to be two commands and you're done, or half a day of work, depending on your chosen flavour of Linux >\_>;;)

- On Windows...

&lt;_sigh_&gt; on Windows it's both "easy" and "truly ridiculous", so here's what I had to do:

- make sure the Hyper-V, Containers, and WSL windows components are installed
- install Docker Desktop, but I'd recommend using [v4.38 of Docker Desktop](https://docs.docker.com/desktop/release-notes/#4380) because I can't get any more recent versions to work properly myself.
- after installing Docker Desktop and restarting (seriously? we need to restart the OS?), first fire up WSL and make sure you have a linux installed. Any will do, just make it install Ubuntu, you don't care (unless you do, in which case you probablya already have something installed. Nice!)

This is about to get stupid. We're not going to do _anything_ with WSL, we just need to have a linux flavour installed _and have a command prompt open for it_.

- Then, we'll need to switch Docker Desktop from using "docker-windows" to using "docker-linux" (i.e. _the thing everyone else uses_), so open Docker Desktop, go to the settings, go to "builders", click the "docker-linux" ⋮ menu and click "use". This will fail with an irrelevant API error.
- Keep Docker Desktop open, and open a cmd prompt with admin rights, cd to `C:\Program Files\Docker\Docker` and then run `DockerCLI.exe -SwitchDaemon`.
- Once that's done, close the command prompt, exit WSL, and quit (really quit, not close-and-minimize) Docker Desktop.
- Reopen Docker Desktop. Check the builders. F'ing magic, it worked, it'll now use linux containers just like every other OS, which is what it should have been using in the first place.

### I already have Docker on Windows, using windows containers...

I have no advice here. This is probably not going to work for you, but if you want to try it anyway and report back, awesome!

## (4) Caddy

Caddy is a general purpose server (similar to Nginx) that automatically handles HTTPS, and lets us set up bindings for things like https://yourproject.app.localhost rather than having to use completely useless http://localhost:someport URLs (where the port number will change any time you restart the server). Installing it on Linux or Mac is relatively easy (tell your package manager to install it. Done), but Windows is (of course) a bit more work:

- Go to https://caddyserver.com/download, pick your windows platform, the click the blue download button.
- Rename the resulting .exe to `caddy.exe`
- Create a folder `C:\Program Files\Caddy` and then move `caddy.exe` into that (this hopefully requires UAC admin rights. If not, I may have questions about why you're logged in with an admin account rather than a normal user account)
- Hit start-x and pick "system"
- on the right of the window that opens, click "advanced system settings"
- In the sysem properties dialog this opens, click the "environment variables" button.
- In the lower panel, scroll down to `path` and double click it.
- Click "new", which will create a new, empty, entry at the bottom, and then click "browse", browse to the `C:\Program Files\Caddy` folder and select that.
- Click OK, then click OK again, then click OK again (omg Windows) and then close the system settings dialog.

You can now run `caddy` anywhere.

### One-time Caddy permissions

When you run the system, Caddy will set up a name binding when you switch projects. However, the first time you do that after having installed it, it will need your permission to add a new certificate authority to your OS's list of certificate authorities. You'll want to allow that, because otherwise localhost HTTPS won't work =)

## (5) Sqlite3

- Windows users will need to head over to https://www.sqlite.org/download.html and download the precompiled "tools" .zip file for your Windows architecture. I'd recommend creating a `sqlite3` folder in your `C:\Program Files\` folder (which hopefully requires UAC, because I very much hope you're not using an admin account as your normal account), and then unpack the .zip file into that folder. Then run `SystemPropertiesAdvanced`, which will open what that name suggests. Click "environment variables", in the bottom panel, scroll down and double click `Path`, and then add the sqlite3 folder as a new entry.
- MacOS users can install `sqlite3` using whatever their favourite package manager is.
- Linux users can install `sqlite3` using their built in package manager.

### !!! WINDOWS WARNINGS !!!

Windows is used by half the planet, and I am not going to tell you not to use Windows because a platform like this should just work everything... but there _are_ some issues with Windows that you need to know about, so they don't bite you in the butt:

#### Windows doesn't have the standard set of unit tools

Kind of ridiculous given what year it is, but windows doesn't come with fundamental tools like `cp`, `rm`, `tar`, etc.

Thankfully that has a super simple solution: make sure to not just install `git` but to also pick the _"Use Git and optional Unix tools from the Windows Command Prompt"_ option. You very much want things like `rm` and `cp` to just work, and they don't require ancient unix-ish-on-windows-ish solutions like CygWin or MinGW32. Just install, and done.

Also, If you already have `git` installed on Windows but you never installed the Unix tools, you can simply (re)run the latest git-scm Windows installer and pick that option.

#### Do not install this platform in a network-shared folder

While for obvious reasons you should never have a network share open for a platform like this (why would anyone on the network be allowed to mess with the data?), it's possible to inadvertently install it in a location that _inherits_ network sharing due to one of its parent folders being shared on the network.

Thankfully, you'll probably discover this real fast because it causes terminal errors: network sharing will cause the COM Surrogate service in Windows to lock files and folders, preventing things like deleting files, or renaming projects, instead causing Node.js to throw an `EPERM` error any time it tries to (re)move data.

If you're seeing those, and examining file locks shows `dllhost.exe` as the locking process, in process explorer: if you see this happening, start checking all parent folders to see if they're being shared on the network.
