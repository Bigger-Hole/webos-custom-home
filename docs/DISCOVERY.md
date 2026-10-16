# Adaptive menus

The frontend’s app catalogue (`src/lib/apps.ts`) is a collection of artwork,
ordering and category hints, not a list of installed apps. Discovery is the
source of truth for tile existence. Only the internal Settings tile is permanent.

## Data flow

1. `useLibrary` requests apps and inputs independently, retaining separate
   success/failure state. Concurrent requests for the same kind share a promise.
2. `src/service/library.ts` first calls the registered launcher service’s
   `discoverApps` or `discoverInputs` endpoint. If that fails, it tries the
   frontend’s direct launch-point/input APIs.
3. The rooted service uses `execFile`, without a shell, to call two fixed,
   read-only Luna endpoints: `com.webos.applicationManager/listApps` and
   `com.webos.service.eim/getAllInputStatus`. No request can supply a URI,
   filename or command. Root startup matters because web-app and service bus
   permissions can differ from a root SSH session.
4. Hidden apps, the launcher itself and input pseudo-apps are excluded from the
   app scan. The service returns app IDs, actual titles and optional icon data.
   Icon files must resolve inside an installed app directory below an allowed
   application root. Symlink/path escapes, SVGs, unsupported formats and files
   over 256 KiB are rejected. The total raster budget is 2 MiB per scan.
5. `src/lib/discovery.ts` validates responses, deduplicates app IDs and applies
   local categories. `buildLists` applies saved user preferences to the discovered
   inventory, keeping input ports separate from apps.

The service uses Node.js 16-compatible APIs. Its discovery methods perform no
installation, input switching or system-setting changes. Input switching occurs only through explicit launcher actions; uninstall is
delegated to Homebrew only after the user confirms a removable app.

## Classification

Exact app-ID hints in `apps.ts` take priority. Additional IDs and conservative,
exact title matches live in `discovery.ts`. Unknown apps default to Misc. The
TV’s app inventory does not reliably provide a universal content category, so
sorting is deliberately correctable by moving tiles. Classifications are local;
no AI endpoint or external catalogue is involved.

Discovered app titles and raster icons are used where available. Bundled artwork
is a fallback for known apps, and other apps receive a letter tile if artwork is
missing or blocked. No app-provided remote image URL is loaded by discovery.

## Input semantics

The internal `game` category ID is retained for saved-layout compatibility, but
all visible labels say Display Inputs. Inputs are identified by HDMI IDs/app IDs
and supplemented by `maxHdmiCount` when reported. There is no fixed four-port
assumption. Supported port numbers are bounded to 1–16.

`hdmiPlugIn` takes precedence over `connected`: on the tested C4, HDMI 4 reports
`connected:true` while `hdmiPlugIn:false`. `hdmiSignalExist` is shown separately.
A missing property is unknown, not false. Cached/failed input status is explicitly
unavailable rather than presenting yesterday’s state as current. A powered-off
device may report no signal or no connection; LG’s reported labels and detection
vary by device/firmware. Device brand detection and CEC power control are not added.

## Refresh and persistence

Apps refresh every 60 seconds and inputs every 10 seconds while the app is
visible. Startup, foreground return and Settings Rescan refresh both. Hidden
background pages are not polled. Results are applied independently so one API
failure does not block the other. Malformed/denied responses are failures, while
a successful empty inventory really removes tiles.

The last successful metadata is stored under `home-library-v1`. Large raster data
is omitted from storage; artwork is read again after a successful scan. Existing
`home-app-order-v1` and `home-hidden-v1` preferences are retained. Absent app IDs
stay in saved preferences so reinstalling can restore manual placement. Reset
app order clears category/order overrides, but does not unhide hidden apps.

Focus is reconciled by app ID after an inventory change. Layout updates are
deferred while holding/reordering a tile and applied after save or cancel.
Corrupt or unavailable local storage cannot prevent startup. With no cache and
no working discovery, empty menus explain how to rescan and Settings remains.

## Scope

This discovers installed launchable applications and HDMI ports. Browser URLs,
USB files, network shares, HDMI-CEC subdevices and per-app content shortcuts are
not separate discovered tiles. Existing weather, audio, Home-button and standby
behaviour is otherwise retained from upstream.


## App removal and return from app exits

Discovery retains the TV’s explicit `removable` flag and suppresses it for system
apps. Manage apps offers a separate Uninstall action for eligible apps. Cancel is
the default confirmation choice, and busy/error states are shown. The client
validates the target again and calls the existing Homebrew `uninstall` method;
it accepts only a completed response. Scans begun before a confirmed removal are
invalidated, and a fresh scan waits for earlier reads to finish.

The `--watch` service opens a fixed, read-only foreground-app subscription using
`service/foreground.js`. Only LG Home/Launcher IDs trigger the custom launcher,
after a 350 ms debounce. A different foreground app cancels the pending redirect.
This preserves Back navigation and exit confirmation inside other apps. Closed
subscriptions reconnect; graceful daemon shutdown stops the child process.
Autostart validates its recorded PID and waits for graceful shutdown before
replacing the daemon.
