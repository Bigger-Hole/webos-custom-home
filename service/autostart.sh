#!/bin/sh
# webosbrew autostart — runs once at cold boot via run-parts (symlinked into
# /var/lib/webosbrew/init.d/ under a no-extension name). Starts the registered launcher
# service with --boot, which brings the custom home app to the foreground (retrying until
# the app manager is ready). Backgrounds the daemon and returns immediately so boot isn't
# blocked. Remove the init.d symlink (or uninstall the app) to disable. No OS files touched.
SVCDIR=/media/developer/apps/usr/palm/services/tld.my.customhome.service
[ -f "$SVCDIR/service.js" ] || exit 0
if [ -f /tmp/home-svc.pid ]; then
  old_pid="$(cat /tmp/home-svc.pid)"
  case "$old_pid" in
    ''|*[!0-9]*) ;;
    *)
      old_cmd="$(tr '\000' ' ' < "/proc/$old_pid/cmdline" 2>/dev/null)"
      case "$old_cmd" in
        tld.my.customhome.service*)
          kill -TERM "$old_pid" 2>/dev/null
          attempts=0
          while kill -0 "$old_pid" 2>/dev/null && [ "$attempts" -lt 20 ]; do
            sleep 0.1
            attempts=$((attempts + 1))
          done
          kill -0 "$old_pid" 2>/dev/null && kill -KILL "$old_pid" 2>/dev/null
          ;;
      esac
      ;;
  esac
fi
export NODE_PATH=/usr/lib/node_modules:/usr/lib/nodejs
cd "$SVCDIR"
# eARC EDITION ONLY (marker file present): re-elevate the service (idempotent) so it keeps the
# "all" LS2 group needed to call settingsservice for eARC recovery. ares-install/reinstall can
# reset the dev ACLs, so we re-run elevate on every cold boot and every deploy. The standard ipk
# omits the EARC marker, so it is NEVER elevated. No-op if hbchannel isn't installed.
ELEVATE=/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service
[ -f "$SVCDIR/EARC" ] && [ -x "$ELEVATE" ] && "$ELEVATE" tld.my.customhome.service >/dev/null 2>&1
nohup /usr/bin/node service.js --boot --watch >/tmp/home-svc.stdout 2>&1 &
exit 0
