# Custom webOS Home

An adaptive home screen for rooted LG webOS TVs: installed apps, HDMI inputs,
a clock and weather, with remote control navigation.

This is [Bigger-Hole’s fork](https://github.com/Bigger-Hole/webos-custom-home) of
[zzeppieri/webos-custom-home](https://github.com/zzeppieri/webos-custom-home).
The original author’s MIT licence and attribution are retained.

## What’s new in 0.5.1

- **Streaming, Media and Misc** are populated from installed, launchable apps.
  Known apps are classified locally; unfamiliar apps start in Misc.
- **Stremio** is recognised automatically and starts first in Streaming on a
  fresh layout, provided it is installed (`io.strem.tv`). Rakuten TV is also
  recognised as Streaming. Saved manual placements take priority.
- **Display Inputs** replaces Gaming. All reported HDMI ports remain listed,
  including unused ports, with the TV’s labels, connection and signal status.
  The launcher does not guess which console is connected.
- Manual categories, ordering and hidden apps survive rescans. Removed apps
  disappear; remembered preferences can be restored when they are reinstalled.
- **Manage apps** offers a confirmed Uninstall action for removable apps, using
  Homebrew Channel. System apps, inputs and the launcher are protected.
- A foreground watcher returns to Custom Home when exiting another app leaves
  LG Home on screen, while preserving the app’s own Back navigation.

The directional hub, animated background, location/weather settings, ambient
clock and Home-button/boot integration come from the upstream project.

![Custom Home clock and animated background — upstream screenshot](docs/main-page.png)

The screenshot shows the upstream clock screen. Its older menu screenshots do
not show this fork’s adaptive menus.

## Remote controls

| Control | Action |
|---|---|
| Home | Open Custom Home when the bundled watcher is enabled |
| Up / Down / Left / Right from the clock | Display Inputs / Streaming / Media / Misc |
| Short OK on a tile | Launch the app or select the input |
| Hold OK | Reorder the selected tile; arrows move it, OK saves, Back cancels |
| Left / Right while moving in Streaming | Move the app to Media / Misc |
| Down while moving in Media or Misc | Move the app to Streaming |

Settings stays in Misc and cannot be hidden. **Settings → Manage apps** controls
visibility; for a removable app, Right selects Uninstall and OK opens a
confirmation with Cancel selected. Uninstalling can remove that app’s own data.
HDMI ports remain in Display Inputs.

Discovery runs at startup, on return to the launcher, every minute for apps and
every ten seconds for inputs while visible. **Settings → Rescan apps and inputs**
refreshes both immediately. Failed scans retain cached menus; cached input status
is marked unavailable until refreshed.

## Install and build

This fork currently publishes **source code**. Follow the
[installation guide](docs/INSTALL.md) to build both the app and its service, install
on a rooted TV, and enable Home/boot integration.

**The inherited one-click installers download upstream v0.4.2. They do not install
this fork.** The files in `installer/` and the original
[tutorial](docs/TUTORIAL.md) are retained as upstream references.

With Node.js **22.18 or newer**:

```sh
gh repo clone Bigger-Hole/webos-custom-home
cd webos-custom-home
npm ci
npm test
npm run typecheck
npm run build
npx --package @webos-tools/cli ares-package dist service -o . --no-minify
```

Packaging only `dist` omits the bundled discovery service and watcher. The TV
service itself uses Node.js 16-compatible APIs. `npm run dev` previews the UI on
a computer, but installed-app discovery and TV launches require webOS; no installed
apps are invented for the desktop preview.

## Compatibility and limitations

Tested on an **LG OLED55C46LA (C4), webOS SDK 9.2.4**, with TV Node.js 16.19.1.
Other models/firmware remain unverified. The Home key code is currently `773`;
remotes with a different code need a service configuration change.

App-exit redirects and two short standby/wake cycles were checked on that C4,
including wake after opening Stremio without pressing Home. Longer standby and
other firmware still need testing. Input labels and connection reporting depend
on the TV; sleeping devices may appear disconnected. Partial/failed scans preserve
known ports and label uncertain status explicitly.

**Known unresolved issue:** web apps were reported to lose sign-ins during earlier
package-based development updates, while Prime Video kept its session. The cause
is unconfirmed. The later development update copied only launcher files, but
session preservation still needs further verification. Discovery contains no
cookie/storage-clearing calls. Avoid repeatedly reinstalling packages as a routine
development refresh; see the installation guide.

## Privacy and implementation

App/input discovery stays on the TV. A bundled rooted service queries LG’s APIs
and returns metadata and bounded raster icons. It adds no analytics or external
app catalogue. The inherited weather widget uses Open-Meteo; streaming apps retain
their own network behaviour.

The service reads input events without grabbing them and observes the foreground
app. It does not modify read-only OS files. The optional upstream eARC edition is
not enabled in this standard build; existing frontend audio-output behaviour is
retained. See [discovery architecture and limits](docs/DISCOVERY.md),
[the TV testing checklist](docs/TESTING.md), and [the changelog](CHANGELOG.md).

Vite, React, TypeScript, Tailwind and Framer Motion build the frontend. Keep the
Lightning CSS Chromium 108 target in `vite.config.ts`: it downlevels newer colour
syntax for the tested TV browser.

## Contributing

Report your TV model, firmware/webOS version, launcher version, reproduction
steps and expected/actual result. Include relevant launcher errors after removing
personal details. For category additions, supply the exact installed app ID and
title; `src/lib/apps.ts` and `src/lib/discovery.ts` hold local hints. Inventory is
authoritative: hints must not create tiles for apps that are not installed.

Run `npm test`, `npm run typecheck` and `npm run build` before submitting changes.
The tests cover discovery, cache/preferences, icon boundaries, app removal,
foreground redirects and remote gestures during refreshes. Hardware acceptance
checks are documented separately.

## Credits and licence

- Original launcher: [zzeppieri/webos-custom-home](https://github.com/zzeppieri/webos-custom-home).
- The upstream constellation background is a Canvas 2D reimplementation inspired
  by Volpots’ “Calm Space | Constellations | Minimalism” Wallpaper Engine scene
  (Steam Workshop item `3323607194`); no original scene assets are used.
- Weather: [Open-Meteo](https://open-meteo.com/).
- Rooted webOS tooling: [webOS Homebrew](https://www.webosbrew.org/).

[MIT](LICENSE). Third-party app names and icons belong to their respective owners
and are included for interoperability. This fork is not affiliated with LG,
Stremio or the other app providers.
