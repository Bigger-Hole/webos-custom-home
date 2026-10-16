'use strict';
var spawn = require('child_process').spawn;

// Observe the foreground app, not the Back key. Streaming apps retain their own
// navigation/exit dialogs; we act only after LG's Home actually takes foreground.
exports.watchForeground = function (options) {
	options = options || {};
	var startProcess = options.spawn || spawn;
	var later = options.setTimeout || setTimeout;
	var cancel = options.clearTimeout || clearTimeout;
	var log = options.log || function () {};
	var child, retryTimer, homeTimer, stopped = false;
	function clearHome() { cancel(homeTimer); homeTimer = undefined; }
	function reconnect() {
		if (!stopped && !retryTimer) retryTimer = later(function () { retryTimer = undefined; connect(); }, 5000);
	}
	function connect() {
		if (stopped) return;
		var buffer = '', ended = false;
		try {
			child = startProcess('/usr/bin/luna-send', ['-i', 'luna://com.webos.applicationManager/getForegroundAppInfo', '{"subscribe":true}'], {stdio: ['ignore', 'pipe', 'pipe']});
		} catch (error) { log('foreground subscription: ' + error.message); reconnect(); return; }
		var stream = child;
		function end() {
			if (ended || stopped) return;
			ended = true;
			clearHome();
			log('foreground subscription closed; reconnecting');
			reconnect();
		}
		stream.on('error', end);
		stream.on('close', end);
		stream.stderr.on('data', function () { /* Never copy OS payloads or app URLs into logs. */ });
		stream.stdout.on('data', function (chunk) {
			if (stopped || ended) return;
			buffer += chunk.toString();
			if (buffer.length > 65536) { buffer = ''; clearHome(); return; }
			var newline;
			while ((newline = buffer.indexOf('\n')) >= 0) {
				var line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
				var data;
				try { data = JSON.parse(line); } catch (error) { continue; }
				if (!data || data.returnValue === false || typeof data.appId !== 'string') { clearHome(); continue; }
				clearHome();
				if (data.appId === 'com.webos.app.home' || data.appId === 'com.webos.app.launcher') {
					// Cancel this if the next app takes foreground during a normal switch.
					homeTimer = later(function () {
						homeTimer = undefined;
						if (!stopped) options.onHome();
					}, 350);
				}
			}
		});
	}
	connect();
	return function stop() {
		if (stopped) return;
		stopped = true;
		clearHome(); cancel(retryTimer);
		if (child) child.kill();
	};
};
