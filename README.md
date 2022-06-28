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
