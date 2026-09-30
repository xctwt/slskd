# webseekd

[![Build](https://img.shields.io/github/actions/workflow/status/xctwt/slskd/fork-build.yml?branch=master&logo=github&label=build)](https://github.com/xctwt/slskd/actions/workflows/fork-build.yml)

A web-based client for the [Soulseek](https://www.slsknet.org/news/) file-sharing network, with release lookups, a settings editor and other quality-of-life features inspired by [Nicotine+](https://nicotine-plus.org/). It is based on slskd and works with an existing slskd configuration and data.

> [!NOTE]
> This is a modified version of slskd.  It is not maintained by, endorsed by, or affiliated with the slskd project or its author(s).
>
> Please report problems with webseekd [here](https://github.com/xctwt/slskd/issues), not to the slskd project.

## Differences from slskd

### Releases (MusicBrainz)

A new **Releases** page finds an album on MusicBrainz first, then looks for it on Soulseek.

- Search by `Artist - Album`, plain text, a MusicBrainz release, release-group or artist link, or a bare release ID.
- See each release's track list, format, label and catalog number, with cover art from the Cover Art Archive. Covers the archive doesn't have are looked up on Deezer and iTunes.
- Search Soulseek for a release in one click. Matching folders are ranked by how many of the release's tracks they hold (by track number, title and length) and by file quality. Download the matched tracks, with or without the folder's other files (cover art, logs), into an `Artist - Album (Year)` folder.
- Releases you search for are saved and linked to their Soulseek searches, so you can come back to them later.

The new `integrations.musicbrainz` options are all optional:

```yaml
integrations:
  musicbrainz:
    disabled: false
    url: https://musicbrainz.org   # point at a mirror to avoid the public rate limit
    request_interval: 1000         # milliseconds between requests; musicbrainz.org allows one per second
    cover_fallback: true           # look up missing covers on Deezer and iTunes
```

### Settings page

A **Settings** page edits `slskd.yml` through forms, organized like Nicotine+'s preferences (Profile, Network, Shares, Downloads, Uploads, Users & Bans, Searches & Rooms, Web & Security, Cleanup, Integrations). It includes:

- An editor for user groups and ban lists.
- A profile editor for the description and picture other users see, with a preview. Uploaded pictures are stored in `<app dir>/profile/`.

Changes are validated by the server and saved together. Only the keys you changed are written; comments, ordering and keys the page doesn't know about are left as they were.

The page needs `remote_configuration: true` in `slskd.yml`, the same as slskd's built-in YAML editor.

### Users

- Every user has a profile page at `/users/<username>`, showing their status, statistics, group, description, picture and shared files. You can ban or unban them there, or gift them days of privileges.
- Clicking a username anywhere (search results, transfers, chat, rooms) opens that user in a side panel without leaving the page.
- Right-clicking a username opens a menu: **View Profile**, **Browse Files**, **Send Message…**, **Open in Users Tab** and **Copy Username**.
- Profiles show a flag for the country the user's IP address is in. Countries come from DB-IP's free [IP to Country Lite](https://db-ip.com/db/download/ip-to-country-lite) database (CC BY 4.0), which is downloaded to `data/geoip/` on first use and again each month. Lookups never leave your machine. To turn this off:

  ```yaml
  integrations:
    geoip:
      disabled: true
  ```

- The **Interests** tab's people lists (**People who like …** and **People like you**) show each user's picture and description. They load a few at a time as the cards scroll into view, because each one needs a connection to that user.

### Searches

- A filter form next to the filter text box, with minimum and maximum size and length, minimum upload speed, maximum queue length, minimum files per folder, required and excluded words, and formats. Filters can be saved and reused.
- A **Clear all** button that deletes every finished search.

### Fixes

- On Windows, paths derived from `--app-dir` are normalized, so values with forward slashes (e.g. `C:/slskd`) no longer break downloads.
- Validating options no longer fails when two requests read the config file at the same time.
- Error messages survive reverse proxies. Cloudflare replaces a 502 from the server with its own error page, so MusicBrainz failures are now reported as 503, with the reason shown in the UI and logged.

### Builds

- There is no published Docker image. Every push to `master` publishes Linux builds (`linux-x64` and `linux-arm64`) to the rolling [`qol-latest`](https://github.com/xctwt/slskd/releases/tag/qol-latest) release.
- [`bin/update-vps`](bin/update-vps) installs the latest build over an existing systemd install and rolls back if it doesn't start.
- Builds are versioned after the slskd release they're based on, e.g. `0.26.0.65534+abc1234`.

## Installing

### Linux server (systemd)

1. Create a user and download the latest build. Use `slskd-linux-arm64.tar.gz` on ARM machines:

   ```sh
   sudo useradd --system --create-home --home-dir /var/lib/slskd slskd
   sudo mkdir -p /opt/slskd
   curl -fL https://github.com/xctwt/slskd/releases/download/qol-latest/slskd-linux-x64.tar.gz \
     | sudo tar -xz -C /opt/slskd
   sudo chown -R slskd:slskd /opt/slskd
   ```

2. Create `/etc/systemd/system/slskd.service`:

   ```ini
   [Unit]
   Description=webseekd
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=slskd
   Group=slskd
   ExecStart=/opt/slskd/slskd --app-dir /var/lib/slskd
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

3. Start it:

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now slskd
   ```

   On the first run webseekd creates `/var/lib/slskd/slskd.yml`. Edit it to add your Soulseek username and password, change the web UI login (the default is `slskd` / `slskd`), and set `remote_configuration: true` if you want to use the Settings page. Then run `sudo systemctl restart slskd`. [`config/slskd.example.yml`](config/slskd.example.yml) lists every option.

4. Open `http://<server>:5030`. If you put it behind a reverse proxy or Cloudflare, see the [reverse proxy guide](docs/reverse_proxy.md), and make sure WebSockets are allowed. Search results and transfers update over a WebSocket connection.

### Docker

Build the image from this repository:

```sh
git clone https://github.com/xctwt/slskd.git
cd slskd
docker build -t webseekd .
```

Then run it with Docker Compose:

```yaml
services:
  webseekd:
    image: webseekd
    container_name: webseekd
    user: "1000:1000"     # or remove this line and set the PUID and PGID environment variables instead
    ports:
      - "5030:5030"       # HTTP
      - "5031:5031"       # HTTPS, with a self-signed certificate
      - "50300:50300"     # incoming Soulseek connections
    environment:
      - SLSKD_REMOTE_CONFIGURATION=true
    volumes:
      - <path/to/application/data>:/app
    restart: always
```

`SLSKD_REMOTE_CONFIGURATION` lets you change settings from the web UI, including the Settings page. You might not want it on an internet-facing install. See the [Docker guide](docs/docker.md) for more.

### From source

Building needs the .NET 10 SDK, Node.js 22 and bash:

```sh
git clone https://github.com/xctwt/slskd.git
cd slskd
./bin/build                              # builds and tests the web UI and the server
./bin/publish --runtime linux-x64        # self-contained build in dist/linux-x64
```

## Updating

- **systemd:** run the update script on the server:

  ```sh
  curl -fsSL https://raw.githubusercontent.com/xctwt/slskd/master/bin/update-vps | sudo bash
  ```

  The script finds the install folder from the `slskd` service. Set `SERVICE=<name>` or `INSTALL_DIR=<folder>` if yours is different. It stops the service, keeps the current version in `<install folder>.previous`, installs the new build, and puts the previous version back if the new one doesn't stay up. Your config and data are not touched.

- **Docker:** run `git pull`, rebuild the image, and recreate the container.

## Migrating from slskd

webseekd uses the same application directory as slskd: the same `slskd.yml`, the same database in `data/`, and the same logs. Nothing needs converting.

1. **Back up your application directory.** This is the folder with `slskd.yml` in it: the path given to `--app-dir`, `~/.local/share/slskd` by default, or the `/app` volume in Docker. For example, `sudo tar -czf ~/slskd-backup.tar.gz -C /var/lib slskd`.
2. **Install webseekd over slskd:**
   - **slskd binaries under systemd:** run the update script from [Updating](#updating). It detects the install folder from your service and replaces only the binaries and web UI.
   - **slskd Docker image:** build the `webseekd` image as described under [Docker](#docker). Stop the old container, then start a new one with the same volumes, ports and environment variables, but with `image: webseekd`.
   - **slskd binaries started by hand:** stop slskd, extract the webseekd build over the old folder (delete the old `wwwroot` folder first), and start it with the same `--app-dir`.
3. **Optional:** set `remote_configuration: true` to use the Settings page, and add an `integrations.musicbrainz` or `integrations.geoip` section if the defaults don't suit you.
4. Open the web UI and hard-refresh (Ctrl+F5). Your browser may still have the old UI cached.

### Going back to slskd

1. Remove the `integrations.musicbrainz` and `integrations.geoip` sections from `slskd.yml`, if you added them. slskd ignores them at startup, but its built-in config editor refuses to save a file containing keys it doesn't recognize.
2. Reinstall slskd: extract an slskd release over the install folder (delete `wwwroot` first), or switch the container back to the slskd image.
3. `data/releases.json` (saved releases) is only used by webseekd, so you can delete it, along with `data/geoip/`. Uploaded profile pictures in `profile/` keep working if `soulseek.picture` points at one.

## Features

### Secure access

webseekd runs as a daemon or Docker container in your network (or in the cloud) and is used from a web browser. It's designed to be exposed to the internet, and everything is secured with a token that [you can control](docs/config.md#authentication). It also supports [reverse proxies](docs/reverse_proxy.md), so it works well with other self-hosted tools.

### Search

Search the same way you would in the official Soulseek client, and enter several searches in quick succession.

### Results

Sort and filter search results with the filters you already know. Dismiss the results you're not interested in, and download the ones you want in a couple of clicks.

### Downloads

Monitor the speed and status of downloads, grouped by user and folder. Click the progress bar to fetch your place in the queue, and use the selection tools to cancel, retry or clear completed downloads. Use the controls at the top to manage downloads by status.

### Everything else

webseekd can do almost everything the official Soulseek client can: browse user shares, join chat rooms and chat privately with other users.

## Configuration

Log in to the web UI with the default username `slskd` and password `slskd` to finish configuring it. Change these if the web UI will be reachable from the internet.

Every option is described in the [configuration guide](docs/config.md), and [`config/slskd.example.yml`](config/slskd.example.yml) is an example configuration file.

The application directory is `~/.local/share/slskd` on Linux and macOS and `%localappdata%/slskd` on Windows, unless you set `--app-dir`. `slskd.yml` is created there the first time the application runs.

## Reverse proxy

webseekd may need extra configuration behind a reverse proxy. See the [reverse proxy guide](docs/reverse_proxy.md).

## License

webseekd is licensed under the GNU Affero General Public License v3.0 (AGPLv3) with Additional Terms pursuant to Section 7 of the AGPLv3. See [LICENSE](LICENSE) for the full text of both, and [NOTICE](NOTICE).
