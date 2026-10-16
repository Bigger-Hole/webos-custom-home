# Test Custom Home 0.5.1 on your TV

Use this after installing the build. Record a pass or the unexpected behaviour
for each item; a phone photo
and the item number are enough for a visual problem.

## Focused checks for 0.5.1

For the 0.5.1 changes, check:

1. Exit Stremio or YouTube using Back and confirm its exit. Custom Home should
   appear after the brief foreground transition, rather than staying on LG Home.
2. Open Settings → Manage apps. Removable apps offer Uninstall; press Right to
   select it and OK to open confirmation. Press OK on the default Cancel choice:
   the app must remain installed. Actual removal is optional—use only an app you
   want to remove. System apps and input ports do not offer Uninstall.
3. When Rakuten TV is installed, rescan: a fresh/default placement is Streaming.
   An existing manual category override still takes priority.
4. Open an already-signed-in web app after this update. It should retain its
   sign-in. Also check again after a TV restart. Report the app name and when the
   sign-in was lost if it happens again.
5. Put the TV in standby for at least 15 seconds, then wake it **without pressing
   Home**. Check once from Custom Home and again from Stremio. LG Home must not
   remain on screen. If the TV resumes Stremio, Home should still open Custom Home.

## Recorded validation and open issues

On an LG OLED55C46LA C4 (webOS SDK 9.2.4), discovery, app launches, category moves,
ordering/hiding persistence, and install/removal detection passed. The Uninstall
dialog was opened and cancelled on hardware; actual confirmed removal was tested
with a simulated service response. LG Home redirection was verified on hardware.

Two short standby tests on 16 October 2026 returned to Custom Home without
pressing Home, including after opening Stremio. A read-only power subscription
confirmed Active Standby → Active cycles. The installed 0.5.1 foreground redirect
handled these tests. Longer standby and other firmware remain unverified.

Web apps were reported to lose sign-ins during earlier development updates while
Prime Video retained its session. This is **not expected**. The exact cause has
not been confirmed; discovery contains no cookie/storage-clearing calls. A later
development update copied only launcher files and reloaded only its page,
bypassing the package installer. Session preservation still needs verification.

Initially missing HDMI tiles appeared correctly after connecting a PC. If this
recurs, capture a photo and note whether it happens at cold boot. The earlier
no-picture report was withdrawn and was not treated as a verified fix.

## Remote-only acceptance checks

| # | What to do | Expected result |
|---|---|---|
| 1 | Press Home, then Up. | The menu is called **Display Inputs**. On the C4 there are four HDMI tiles, including unused ports. No preset PS5/Switch names appear unless the TV itself reports those labels. |
| 2 | Inspect HDMI 2 and the unused ports. | HDMI 2 uses the TV’s Samsung soundbar label. Each tile identifies its HDMI number and shows connection/signal status. An empty port says **Not connected**; a plugged-in device without video can say **Connected · no signal**. |
| 3 | Switch a spare connected device on/off or unplug/reconnect its HDMI cable, then return Home → Up. | The appropriate status updates on return, or within about ten seconds while the launcher is visible. Every port remains listed. Prefer a spare source rather than disconnecting the soundbar. |
| 4 | Select the HDMI port of a device with a picture and press OK. Then press Home. | The TV switches to that port; Home returns to Custom Home. Selecting a connected audio-only port may have no picture. |
| 5 | Home → Down to Streaming. Open Stremio and Prime Video, returning with Home between them. | Installed streaming apps appear and launch. Apps that are not installed do not appear. Stremio is first on a fresh layout; your saved order takes priority. |
| 6 | Home → Left to Media; Home → Right to Misc. | YouTube and Spotify are in Media. Utilities such as LG Input Hook/Homebrew are in Misc. Unfamiliar apps may be in Misc. Custom Home does not list itself. |
| 7 | In Streaming, hold OK on a tile, move it Up/Down, then press OK to save. Repeat a move but press Back to cancel. | Saving keeps the new order. Cancel restores the previous order. A background refresh does not interrupt a held tile. |
| 8 | Hold OK on an app in Streaming and press Left to move it to Media. | The app appears in Media once, and disappears from Streaming. You can move it back by holding OK in Media and pressing Down. Inputs stay in Display Inputs. |
| 9 | In Misc, find Settings. Open **Manage apps**, hide one app, then leave Settings. | The chosen tile disappears. Settings cannot be hidden. Reopen Manage apps and show the app again when finished. |
| 10 | Settings → **Rescan apps and inputs**. Repeat after changing tile order/category/hiding one app. | A completion message appears. Your custom order, category and hidden choices survive. There are no duplicate tiles. |
| 11 | Install an app you actually want through the LG store or Homebrew Channel, then return Home. | It appears automatically in an appropriate menu, or Misc if unfamiliar. No source edit is needed. Rescan is available if the TV takes time to complete installation. |
| 12 | Optional: uninstall a disposable app you can reinstall, then return Home. | It disappears after a successful scan. Other tiles remain. Reinstalling restores remembered manual placement/hiding if it had any. Do not remove Stremio just to test this. |
| 13 | Put the TV in standby for at least 15 seconds, then wake it without pressing Home. Repeat from inside Stremio. Check Home separately, then later test a normal TV restart. | LG Home does not remain on screen after wake. If the previous app resumes, Home opens Custom Home. Saved preferences remain; app/input discovery refreshes. Cached input status can briefly say **Status unavailable** before the first successful scan. |

For a quick first pass, do **1, 2, 4, 5, 9 and 10**. Then check the rest on each
new TV/firmware combination. If a menu is empty, Settings → Rescan is the first troubleshooting
step. Unknown apps going to Misc and generic HDMI names are expected fallbacks.

## Report back

Copy and fill in:

```text
TV testing: Custom Home 0.5.1
1–6: pass / item number + what happened
7–10: pass / item number + what happened
11–13: pass / skipped / item number + what happened
Anything visually wrong:
```

## Automated developer checks

Use Node.js 22.18+ on the computer; the TV service supports Node.js 16.

```sh
npm ci
npm test
npm run typecheck
npm run build
node --check service/service.js
node --check service/discovery.js
```

The automated suite covers inventory filtering/classification, duplicate IDs,
malformed responses, input counts/status semantics, independent scan failures,
cache restart, manual placement/hidden preferences, missing-app reinstalls,
selection reconciliation, bridge fallbacks, bounded icon reads and path escapes.
External Luna calls are substituted only at their transport boundary. The icon
tests use actual temporary files and symlinks.

Browser checks additionally exercise remote-style navigation, launch payloads,
category moves, rescans, live inventory changes, stable focus, scan failures and
recovery. Physical HDMI behaviour, standby and the remote’s Home button still
need the TV checks above.
