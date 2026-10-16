# Install this fork

This guide is for an **already rooted** LG webOS TV with Homebrew Channel and SSH
working. Rooting itself is outside this guide. Keep LG’s Developer Mode app
uninstalled on a rooted TV. Compatibility has been checked on a C4 only; see the
[README](../README.md) for limitations and the unresolved sign-in report.

The inherited installers in `installer/` download upstream v0.4.2. Use the build
below for this fork. This guide does not enable the optional upstream eARC edition.

## 1. Build on your computer

Install Node.js 22.18+, GitHub CLI, and the webOS CLI. Then:

```sh
gh repo clone Bigger-Hole/webos-custom-home
cd webos-custom-home
npm ci
npm test
npm run typecheck
npm run build
npx --package @webos-tools/cli ares-package dist service -o . --no-minify
```

The output is `tld.my.customhome_0.5.1_all.ipk`. Both `dist` and `service` must be
packaged. Keep `--no-minify`; the older packager minifier cannot handle this bundle.

## 2. Configure access and install

Install the CLI if needed:

```sh
npm install -g @webos-tools/cli
ares-setup-device
```

Create a profile named `tv` for your rooted TV’s IP address, SSH port 22 and root
account, using your TV’s SSH credentials. Check the profile:

```sh
ares-setup-device --list
ares-install --device tv tld.my.customhome_0.5.1_all.ipk
ares-launch --device tv tld.my.customhome
```

This uses the same app ID as upstream, so installation updates an existing
Custom Home installation. Back up an existing launcher before replacing it.
Discovery does not change other apps’ data, but repeated package updates during
development coincided with sign-in loss in web apps on the test TV; that cause
remains unconfirmed.

## 3. Enable Home and boot integration

Connect from your computer, replacing `YOUR_TV_IP` with your TV’s address:

```sh
ssh root@YOUR_TV_IP
```

Run the following **inside the TV’s SSH shell**:

```sh
SVCDIR=/media/developer/apps/usr/palm/services/tld.my.customhome.service
test -f "$SVCDIR/autostart.sh"
chmod +x "$SVCDIR/autostart.sh"
mkdir -p /var/lib/webosbrew/init.d
ln -sf "$SVCDIR/autostart.sh" /var/lib/webosbrew/init.d/50-customhome
sh "$SVCDIR/autostart.sh"
```

If the `test` command fails, stop and check that the app and service were both
installed. The startup script launches Custom Home and starts the watcher. The
link makes webOS Homebrew start it at cold boot. Home is read from the remote
without grabbing input; a foreground subscription handles returns to LG Home.
Standby does not run init.d again. Test wake separately without pressing Home.

Package installation can stop the running watcher. After an update, rerun
`sh "$SVCDIR/autostart.sh"` in a fresh TV shell after setting `SVCDIR` as above.
The link persists unless removed.

## 4. Check the result

- Press Home, then Down: installed streaming apps should appear.
- Press Up from the clock: Display Inputs should show all reported HDMI ports.
- Open an app, then exit using Back and its own confirmation. LG Home should
  redirect to Custom Home after a short transition.
- Put the TV in standby, then wake without pressing Home. Check this separately
  from the Home-button test.
- Open Settings → Location to choose your weather location.

Use the [full testing checklist](TESTING.md) before relying on the launcher on a
new model. App discovery, native input switching and standby cannot be verified
by a desktop browser preview alone.

## Development updates and troubleshooting

Use `npm run dev` for UI work before updating hardware. The inherited
`npm run deploy` script rebuilds and reinstalls the package; it also assumes an
SSH key and a default TV address. It is not a file-only development refresh.
Inspect its configuration before use, and prefer the explicit steps above.

A file-only update should replace only this launcher’s files, retain backups,
restart its watcher when service files change, and reload only the launcher page.
Do not clear global browser storage or reinstall unrelated apps to refresh the UI.
The current repository does not provide an automated file-only updater.

For a read-only watcher check, run these on the TV:

```sh
cat /tmp/home-svc.pid
tail -n 40 /tmp/home-svc.log
```

A successful launch logs `returnValue:true`. The standard build logs that eARC
recovery is disabled. If menus are incomplete, try Settings → Rescan apps and
inputs; a failed scan retains cache rather than removing everything. The service
must be started through the rooted startup path for its discovery child processes
to have the tested permissions.

## Disable integration or remove the launcher

To disable future boot startup, run this **on the TV**:

```sh
rm -f /var/lib/webosbrew/init.d/50-customhome
```

Then restart the TV fully to stop the current watcher. Custom Home remains an
ordinary launchable app. To remove it completely, use Homebrew Channel’s app
manager after disabling the startup link. Removal can delete this launcher’s
saved settings. No factory reset or read-only OS edit is required.
