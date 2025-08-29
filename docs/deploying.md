# Deploying this platform

I'll be using an exotic mix of services for maximum "this'll probably fit your bill", but if not, you can probably figure out how to deploy on your less complicated setup from reading these instructions. 

- I'm using domains registered at NameCheap
- I'm using DNS handling through Digital Ocean
- I'm using an unrelated third party VPS for actual hosting

So with that:

## Setting up the domains

In my case, I had to point my NameCheap domains (webblythings.com and webblythings.online) to use the DigitalOcean nameservers (ns1.digitalocean.com, ns2.digitalocean.com, and ns3.digitalocean.com).

On the DigitalOcean side, on the "Networking" page, under the "Domains" tab, I've added my domains with the following A records for webblythings.com:

- `A @ my-VPS-IP`
- `A make my-VPS-IP`

This sends `webblythings.com` and `make.webblythings.com` to my VPS IP. So far so good. Then, for the `webblythings.online` domains:

- `A @ my-VPS_IP`
- `A * my-VPS_IP`

This sends `webblythings.online` and `*.webblythings.online` to my VPS IP. That last one if a wildcard domain because we don't know what projects are going to exist, they should just all go to my hosting VPS.

## Setting up the platform

The platform needs a bunch of software to be installed before it'll work, so... let's assume you're using Ubuntu 22, but if you're not, you can probably figure out the differences and adjust things appropriately.

### Set up SSH-key based SSH login

Just in case you were tempted to keep using a root:password combination to SSH into your host. 

Set up proper login using SSH keys. 

There are lots of guides for this on the internet, pick your favourite one and follow the instructions.

### Firewall your host

Enable a firewall that only allows http(s) and SSH:

```
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

A good start. `ufw status` should confirm that only ports 22, 80, and 443 are open now.

### Confirm git is installed

This should already be installed? But `sudo apt update` and then `sudo apt install git` should ensure you're on the latest version of `git`, too.

### Install Node.js

We're obviously going to need Node.js, which I highly recommend you install [using NVM](https://github.com/nvm-sh/nvm), and then once that's done (and you made sure to run the command to make `nvm` an active command without needing to restart), running:

```
nvm install 22
nvm alias default 22
nvm use 22
```

Done, any session should from now on default to using Node 22 (the LTS version at time of writing).

### Install Docker

See https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-20-04 (whether you're on on 20 or 22, or 24, the instructions are the same). It's more work than it should be, but it's also not particularly complicated, just a whole bunch of copy-paste.

### Set up Caddy

Oh boy... 

(1) We'll need to install `go`, because we're going to need to custom-build `caddy` with DO's DNS module, using `xcaddy`.

Instructions to install `go` are over on https://go.dev/doc/install (do _not_ use `apt` unless you want a five year out-of-date version). You'll need to update your PATH after that finishes because it installs the `go` executable in its own dir so either update the universal envirmont (`/etc/environment`) or add a PATH update to your `.bashrc` or the like.

And then remember to `source` those changes unless you want to log off and log back in of course.

(2) Install `xcaddy`. The https://github.com/caddyserver/xcaddy page has solid instructions and honestly, just using the go instruction is the least likely to fail.

We can then build `caddy` with support for DigitalOcean's domain API to handle our wildcard domain resolution:

```
xcaddy build --with github.com/caddy-dns/digitalocean@master
```

(3) This will write a `caddy` executable to the dir you just ran that in, which we'll need to move to `/usr/lib`, so when that finishes:

```
sudo mv caddy /usr/bin
sudo chown root:root /usr/bin/caddy
sudo chmod 755 /usr/bin/caddy
```

We can now confirm that we've got the right "flavour" of caddy installed: `caddy list-modules` should show the digitalocean DNS module all the way at the end:

```
...
tls.leaf_cert_loader.pem
tls.leaf_cert_loader.storage
tls.permission.http
tls.stek.distributed
tls.stek.standard

  Standard modules: 127

dns.providers.digitalocean

  Non-standard modules: 1

  Unknown modules: 0
```

If so: time to move on to the next step.

### Install SQLite 3

Oh thank god, something we can finally just `apt install sqlite3` again!

### Install PM2

While plain Node.js is fine for dev work, we're going to be running this as a production application, and we don't want an uncaught `throw` somewhere in the code to take down the entire platform: we'll be using [pm2](https://pm2.keymetrics.io/) to make sure that if our platform errors out, or even if our host restarts, things just go right back to running.

```
npm i -g pm2
```

## Setting up API keys...

In order for things to work properly, you'll need to have set up a GitHub OAuth app (so you can log in), and you'll need to have a DigitalOcean API key (so that `*.webblythings.online` actually works).

### GitHub OAuth

Hit up https://github.com/settings/developers and create a new oauth app. As homepage you'll want `https://make.yourdomainhere.com`, and as callback URL you'll want `https://make.yourdomainhere.com/auth/github/callback`

Then, after creating the app binding, you'll need to generate a secret. Hang on to that, you'll need it during setup.

### DigitalOcean API key

Log into DO and go to https://cloud.digitalocean.com/account/api/tokens, then generate a new personal token with `domains` as the only required scope (all of them, though: caddy's going to need to be able to read and write DNS entries)

Again: hang on to that key, you'll need this one during setup, too.

## Clone the project

Standard fare:

```
cd ~
git clone https://github.com/Pomax/make-webbly-things.git
cd make-webbly-things
nvm use 22
npm i
```

We shouldn't need that `nvm` instructions, but it never hurts to make sure =)

## Run the setup script

Finally, we can bootstrap the platform:

```
node setup
```

When asked for your domains, fill in the domains you have lined up, making sure not to include the `https://` part: the setup is asking for hosts, not websites.

When asked for your github id and secret, fill those in.

When asked whether you want to set up TLS, the answer is yes. This will ask you to inpute the TLS provider, which is `digitalocean`, and your API key, which is the DigitalOcean API key you made.

## Running the platform forever

The setup script should run to completion and tell you to run `npm start`, which is what you do for local dev, but for production deployment we don't want to just run `npm start`, we need to let `pm2` handle things instead:

```
pm2 start "npm start"
```

Then, because we want `pm2` to autorun on startup:

```
pm2 save
pm2 startup systemd
```

This may tell you that you need to run a sudo command. If so... run that =)

Then make sure pm2 is enabled as a service:

```
systemctl enable pm2-root
```

## Confirm that things work!

The platform will now be running in "first sign in" mode, so load up the editor URL that gets printed to the console, and click the github login link. Grant permission to your app and you should end up getting redirected to the editor main page, this time with your name, and text that says you're an admin.

Congratulations, you're done!

Well, almost: go remix one of the starter projects, because you'll want to verify that your app domain works, too. For example, pick the `basic-html` project and click the remix button, which should open the editor interface with your remix's code as well as a preview on the right that's not actually a preview, but the actual website that got built for your project. Click the "new tab" button to load it on its own.

