# OpenVSCode GDrive

## What is this?

This is a Web-based version of Microsoft's open source [VS Code](https://code.visualstudio.com) text
editor backed by Google Drive.  It is a server that runs on a remote GNU/Linux machine and affords
clients access to the editor, a terminal, and optionally a graphical desktop.  Specifically, it is
Gitpod's [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) distribution configured
to use Google accounts for authentication and Google Drive (via [Rclone](https://rclone.org)) for
storage.

To support running graphical applications, it can optionally provide a virtual desktop using
[TigerVNC](https://tigervnc.org) and a hosted copy of the Web-based [noVNC](https://novnc.com)
client.


## What are its limitations?

This project uses Linux namespaces for containerization, and as such only supports recent versions
of that kernel.  Practically, it requires a multicore server or virtual machine because it creates
an independent container running a separate instance of Node, Rclone, TigerVNC, and noVNC's proxy
server for each authenticated user.  Running it as a microservice is infeasible.

As in OpenVSCode Server, some preferences and extensions are stored in the client's browser, and
others are stored on the filesystem.  The former class mean that a user's experience can change as
they move from seat to seat, and the latter pose performance problems for certain addons.  In
particular, language extensions and run/debug support are unlikely to work when installed by users,
so out of the box most compilation and execution should be performed on the command line.  If
language extensions are needed, it may be possible to support them by copying their files into the
container's VSCode installation directory rather than running them out of each user's home.

Isolation is accomplished using containers and processes, and is at most as secure as the hosting
Linux kernel.  This project is designed to be run on a headless server; running it on a desktop may
expose the rest of the system, via the X Window System, to attacks including privilege escalation
and write access to other users' Google Drive files.


## How do I set it up?

You need two things: a Google domain with a registered OAuth application permitting authentication
and access to Google Drive, and a server or virtual machine to run this project on.


### Registering a per-domain OAuth application

This section assumes (1) that your school or organization uses Google Workspace, (2) that you have
an account in the same domain as your students or users, and (3) that your account has access to the
Google Cloud console.  Unless you request Google's approval, only users from the single domain in
question will be able to log in; therefore, if (1) is not true, you might consider registering your
own domain for [Google Cloud Identity
Free](https://cloud.google.com/identity/docs/set-up-cloud-identity-admin) and creating domain
accounts for your users.  If (2) or (3) is not true, you will need to ask your IT department for
assistance.

1. Go to [console.cloud.google.com](https://console.cloud.google.com), sign in with your domain
   account, and accept the terms of service if applicable.

1. In the upper-left corner of the page, click **Select a project**:

   ![select a project button](docs/select_a_project_button.png)

1. In the upper-right corner of the resulting dialog, click **new project**:

   ![select a project dialog](docs/select_a_project_dialog.png)

1. Give your project a(n internal) name and hit **create**:

   ![new project page](docs/new_project.png)

1. Once the Notifications panel shows a green check mark, click **select project**:

   ![notifications](docs/notifications.png)

1. If no sidebar is open on the left side of the page, click the hamburger button in the upper left:

   ![navigation menu button](docs/hamburger.png)

1. In the sidebar on the left, hover over **APIs & Services** and select **Enabled APIs & services**:

   ![APIs & Services menu](docs/apis_and_services.png)

1. At the top of the page, click **enable APIs and services**:

   ![enable button](docs/enable_apis_and_services.png)

1. Scroll down to find Google Workspace and click **Google Drive API**:

   ![Google Workspace heading](docs/workspace.png)

1. Click the blue **enable** button and wait for the spinner to go away and the page to reload:

   ![enable button 2: electric boogaloo](docs/enable.png)

1. On the left side of the page, click **OAuth consent screen**:

   ![OAuth consent screen button](docs/oauth_consent_screen.png)

1. Set User Type to **Internal** and click **create**:

   ![user type radio buttons](docs/user_type.png)

1. Give your project a (user-facing) name, provide the required contact email addresses, and hit
   **save and continue**:

   ![app name field](docs/app_name.png)

1. Click the **add or remove scopes** button:

   ![add or remove scopes button](docs/add_or_remove_scopes.png)

1. Under Manually add scopes, enter `https://www.googleapis.com/auth/drive`, click **add to table**,
   then click **update**:

   ![manually add scopes](docs/manually_add_scopes.png)

1. Click **save and continue**:

   ![scopes page](docs/scopes.png)

1. On the left side of the page, click **Credentials**:

   ![credentials button](docs/credentials.png)

1. At the top of the page, click **create credentials** and choose **OAuth client ID**:

   ![create credentials menu](docs/create_credentials.png)

1. Set Application type to **Web application** and give it a(n internal) name:

   ![application type and name fields](docs/application_type_and_name.png)

1. Under Authorized redirect URIs, click **add URI**:

   ![authorized redirect URIs heading](docs/authorized_redirect_uris.png)

1. Enter the domain name at which you will host your server and hit **create**:

   ![URI field](docs/uris_1.png)

1. Click the **download JSON** button in the resulting dialog, and save the file for later:

   ![download JSON button](docs/download_json.png)


### Optional: Creating a Google Cloud virtual machine

This section illustrates how to set up a hosted VM on Google Cloud, which is free in the short term
under the service's trial.  There is no technical reason this project has to be hosted on Google
infrastructure.  Skip this section if you already have a server or VM available.

1. From the Google Cloud console at [console.cloud.google.com](https://console.cloud.google.com),
   click the **activate** button in the upper-right corner of the page and follow the resulting
   steps to start your free trial:

   ![activate button](docs/activate.png)

1. In the upper-left corner of the page, click **Select a project** or the name of the selected
   project:

   ![select a project button](docs/select_a_project_button.png)

1. In the upper-right corner of the resulting dialog, click **new project**:

   ![select a project dialog](docs/select_a_project_dialog.png)

1. Give your project a(n internal) name and hit **create**:

   ![new project page](docs/new_project.png)

1. Once the Notifications panel shows a green check mark, click **select project**:

   ![notifications](docs/notifications.png)

1. If no sidebar is open on the left side of the page, click the hamburger button in the upper left:

   ![navigation menu button](docs/hamburger.png)

1. In the sidebar on the left, hover over **VPC network** and select **IP addresses**:

   ![VPC network menu](docs/vpc_network.png)

1. Click the **reserve external static address** button:

   ![reserve external static address button](docs/ip_addresses.png)

1. Give the IP address a name, set its Network Service Tier to **Standard**, and hit **reserve**:

   ![reserve a static address page](docs/reserve_a_static_address.png)

1. Take note of the IP address on the resulting page, as you will need it later:

   ![IP address display](docs/ip_address.png)

1. If you do not want your instance to support GUI applications, skip this step.  Otherwise, in the
   sidebar on the left, hover over **VPC network** and select **Firewall**.  Click the **create
   firewall rule** button at the top.  Name the rule `allow-novnc`, leave Direction of traffic set
   to Ingress and Action on match set to Allow, and set Targets to **All instances in the network**
   and Source IPv4 ranges to `0.0.0.0/0`.  Check the **TCP** box and enter `6081-7999`.  Finally,
   hit the **create** button.

   ![create a firewall rule page](docs/create_a_firewall_rule.png)

1. In the sidebar on the left, hover over **Compute Engine** and select **VM instances** under
   virtual machines:

   ![Compute Engine menu](docs/compute_engine.png)

1. Click the blue **enable** button and wait for the spinner to go away and the page to reload:

   ![enable button](docs/enable_compute_engine.png)

1. At the top of the page, click **create instance**:

   ![create instance button](docs/create_instance.png)

1. Select a name and region, and leave the default Debian boot disk image selected:

   ![name and region](docs/name_and_region.png)

1. Under Firewall, check both **Allow HTTP traffic** and **Allow HTTPS traffic**:

   ![firewall](docs/firewall.png)

1. Expand **networking, disks, security, management, sole-tenancy**, expand **Networking**, then
   expand **default** under Network interfaces:

   ![network interfaces heading](docs/network_interfaces.png)

1. Set **External IPv4 address** to the one you created above and hit **done**:

   ![external IPv4 address dropdown](docs/external_ipv4_address.png)

1. At the bottom of the page, hit the **create** button:

   ![create button](docs/create.png)

1. On the resulting page, wait for the Status spinner to turn into a green check mark, then click
   the SSH button:

   ![VM instances page](docs/vm_instances.png)


## Starting the server

Follow these steps to launch this project.  They assume you are sitting at a shell prompt on the
server or VM on which you want to host your instance.  If the domain you used as the authorized
redirect URI when registering the OAuth application does not yet point to the server or VM, first
configure your domain's nameserver to serve an A record (and/or AAAA record, if applicable) mapping
that domain to the server or VM's IP address.

1. Run the command: `$ unshare --version`

   If the current version number is less than 2.38, upgrade the distribution to a newer version if
   possible.  For instance, in the case of Debian, you should be running bookworm or later.  To
   upgrade from bullseye:
   ```
   $ sudo sed -i s/bullseye/bookworm/g /etc/apt/sources.list
   $ sudo apt update
   $ sudo apt dist-upgrade
   $ sudo apt autoremove --purge
   $ sudo reboot
   ```

   If you have an old version of the command but upgrading your distribution is infeasible, instead
   run the following additional commands, verifying
   that the version number printed by the last line is now 2.38:
   ```
   $ sudo apt install binutils uidmap
   $ curl -o util-linux-2.38-2_amd64.deb http://snapshot.debian.org/archive/debian/20220413T031740Z/pool/main/u/util-linux/util-linux_2.38-2_amd64.deb
   $ ar x util-linux-2.38-2_amd64.deb data.tar.xz
   $ tar xf data.tar.xz ./usr/bin/unshare
   $ curl -o libc6_2.33-1_amd64.deb http://snapshot.debian.org/archive/debian/20211212T154235Z/pool/main/g/glibc/libc6_2.33-1_amd64.deb
   $ ar x libc6_2.33-1_amd64.deb data.tar.xz
   $ tar xf data.tar.xz ./lib/x86_64-linux-gnu/ld-2.33.so ./lib/x86_64-linux-gnu/libc.so.6 ./lib/x86_64-linux-gnu/libc-2.33.so ./lib/x86_64-linux-gnu/libnss_files.so.2 ./lib/x86_64-linux-gnu/libnss_files-2.33.so
   $ rm data.tar.xz
   $ cat >unshare <<-tac
   #!/bin/sh

   mypath="\`realpath "\$0"\`"
   mydir="\`dirname "\$mypath"\`"
   exec "\$mydir/lib/x86_64-linux-gnu/ld-2.33.so" --library-path "\$mydir/lib/x86_64-linux-gnu" "\$mydir/usr/bin/unshare" "\$@"
   tac
   $ chmod +x unshare
   $ sudo ln -s "$PWD/unshare" /usr/local/bin
   $ `which unshare` --version
   ```

1. Run the command: `$ sudo apt install python3-certbot-apache`

1. Run the command: `$ sudo certbot --apache`

1. Answer the configuration prompts and wait for verification to complete.  (Note that this requires
   HTTP to be allowed through any firewall(s) in addition to HTTPS.)

1. Run the command: `$ sudo cp /etc/apache2/sites-available/000-default-le-ssl.conf
   /etc/apache2/sites-available/openvscode-gdrive.conf`

1. Edit the `openvscode-gdrive.conf` file, replacing the `DocumentRoot` line with the following:
   ```
   ProxyPass / http://localhost:8000/
   ProxyPassReverse / http://localhost:8000/
   RewriteEngine on
   RewriteCond %{HTTP:Upgrade} websocket [NC]
   RewriteCond %{HTTP:Connection} upgrade [NC]
   RewriteRule ^/?(.*) "ws://localhost:8000/$1" [P,L]
   ```

1. Run the command: `$ sudo a2dissite 000-default 000-default-le-ssl`

1. Run the command: `$ sudo a2enmod proxy_http proxy_wstunnel`

1. Run the command: `$ sudo a2ensite openvscode-gdrive`

1. Run the command: `$ sudo systemctl restart apache2`

1. Run the command: `$ sudo apt install unzip`

1. Follow the Deno installation instructions at [deno.land](https://deno.land), being sure to use a
   version no older than 1.21.0.

1. Run the command: `$ sudo apt install git`

1. Use `git clone` to clone this repository, then `cd` into the resulting directory.

1. Run the command: `$ ./deps.ts`

1. Answer each of the configuration prompts or hit enter to select its default.  If you want support
   for GUI applications, be sure to answer `y` at the appropriate time.

1. Upload the JSON file you downloaded when registering the OAuth application and rename it to
   `config.json`.

1. Run the command: `$ sudo apt install uidmap fuse3`

1. If you do not want your instance to support GUI applications, skip this step.  Otherwise, run the
   command: `$ sudo apt install xkb-data x11-xkb-utils x11-xserver-utils`

1. Run the command: `$ ./main.ts`


## Daemonizing the server

The easiest way to start a server process that survives the end of your login session is to use
`bash`'s `disown` builtin:
```
$ ./main.ts >disown.log 2>&1 &
$ disown %1
```

Alternatively, you can run the server from within a terminal multiplexer such as `screen` or `tmux`.
Note that disowning via `nohup` currently breaks garbage collection of stale sessions, thereby
causing major resource leaks for instances shared by many users.
