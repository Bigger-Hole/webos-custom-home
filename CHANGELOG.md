# Changelog

## 0.5.1

First source publication of the adaptive-menu fork, based on upstream 0.4.2.
Includes the adaptive work developed as 0.5.0 and the following follow-up fixes.

### Added

- Installed-app discovery with local Streaming/Media/Misc classification,
  Stremio and Rakuten TV recognition, and actual app titles/icons.
- Display Inputs with all reported HDMI ports, TV labels, connection/signal
  status and conservative handling of partial responses.
- Independent app/input refresh, cached menus and Settings rescan.
- Removable-app Uninstall action with confirmation and system-app protection.
- Foreground watcher that redirects LG Home after another app exits.
- Architecture, build/install and hardware testing documentation; 44 automated
  tests for discovery, preferences/cache, icon bounds, removal, foreground
  transitions and remote navigation.

### Fixed

- Rescans retain manual category/order/hidden preferences and selected-app focus.
- An OK hold survives inventory refresh; a removed tile cannot launch its replacement.
- Stale scans cannot put a just-uninstalled app back in the menu.
- Autostart waits for the previous watcher to stop and cleans up its subscription.
- Refreshed locked transitive build-tool dependencies.
- Marked the startup script executable and documented its installation permission.

### Validation and known limits

Automated tests, TypeScript checks and production build passed. On an LG C4,
app/input discovery, launches, ordering/hiding, installation/removal detection,
Home-button integration, and two short standby/wake checks passed. The new
Uninstall dialog was opened and cancelled on hardware; confirmed removal was
covered with a simulated service response, without deleting a real test-TV app.

Other TV models, longer standby, and repeated package-update session preservation
remain unverified. Web-app sign-ins were reported lost during earlier development
updates; the exact cause is unresolved. Initially missing HDMI tiles appeared
correctly after a source was connected; report recurrence with model/firmware and
boot state. See [TESTING.md](docs/TESTING.md) for the acceptance checklist.
