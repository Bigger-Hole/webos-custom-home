'use strict';
// Fixed, read-only discovery calls. No caller-supplied URI, path or shell command.
// luna-send runs under the rooted autostart service. A web app's direct bridge can
// have narrower permissions even when the service process itself is root.
var fs = require('fs').promises;
var path = require('path');
var execFile = require('child_process').execFile;
var ICON_ROOTS = [
	'/usr/palm/applications', '/media/cryptofs/apps/usr/palm/applications',
	'/media/developer/apps/usr/palm/applications', '/media/system/apps/usr/palm/applications',
	'/mnt/otncabi/usr/palm/applications'
];

exports.createDiscovery = function (options) {
	options = options || {};
	var execute = options.execFile || execFile;
	var rootsPromise;
	var pending = {};
	function roots() {
		if (!rootsPromise) rootsPromise = Promise.all((options.iconRoots || ICON_ROOTS).map(function (root) {
			return fs.realpath(root).catch(function () { return null; });
		})).then(function (items) { return items.filter(Boolean); });
		return rootsPromise;
	}
	function readLuna(uri) {
		return new Promise(function (resolve, reject) {
			execute('/usr/bin/luna-send', ['-n', '1', '-w', '3500', uri, '{}'], {timeout: 4500, maxBuffer: 8 * 1024 * 1024}, function (err, stdout) {
				if (err) { reject(err); return; }
				try {
					var data = JSON.parse(stdout);
					if (!data || typeof data !== 'object' || data.returnValue === false) throw new Error('TV discovery API unavailable');
					resolve(data);
				} catch (error) { reject(error); }
			});
		});
	}
	async function iconFor(app, budget) {
		try {
			if (typeof app.folderPath !== 'string' || typeof app.icon !== 'string') return;
			var folder = await fs.realpath(app.folderPath);
			var allowed = await roots();
			if (!allowed.some(function (root) { return folder.indexOf(root + '/') === 0; })) return;
			var candidate = await fs.realpath(path.resolve(folder, app.icon));
			if (candidate.indexOf(folder + '/') !== 0 || !/\.(png|jpe?g|webp|gif)$/i.test(candidate)) return;
			var stat = await fs.stat(candidate);
			if (!stat.isFile() || stat.size > 256 * 1024 || stat.size > budget.remaining) return;
			var bytes = await fs.readFile(candidate);
			if (bytes.length > 256 * 1024 || bytes.length > budget.remaining) return;
			var mime;
			if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'png';
			else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'jpeg';
			else if (/^GIF8[79]a/.test(bytes.toString('ascii', 0, 6))) mime = 'gif';
			else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'webp';
			if (!mime) return;
			budget.remaining -= bytes.length;
			return 'data:image/' + mime + ';base64,' + bytes.toString('base64');
		} catch (error) { /* Missing/unreadable artwork uses the frontend fallback. */ }
	}
	function shared(key, scan) {
		if (!pending[key]) pending[key] = scan().finally(function () { delete pending[key]; });
		return pending[key];
	}
	return {
		apps: function () { return shared('apps', async function () {
			var data = await readLuna('luna://com.webos.applicationManager/listApps');
			if (!Array.isArray(data.apps)) throw new Error('Installed app list missing');
			var apps = [];
			var budget = {remaining: 2 * 1024 * 1024};
			for (var app of data.apps) {
				if (app && (app.visible === false || (app.class && app.class.hidden === true))) continue;
				if (!app || typeof app.id !== 'string' || !app.id || typeof app.title !== 'string' || !app.title.trim()) throw new Error('Incomplete installed app list');
				if (app.id === 'tld.my.customhome' || /^com\.webos\.app\.hdmi\d+$/.test(app.id)) continue;
				apps.push({id: app.id, title: app.title, removable: app.removable === true && app.systemApp !== true, icon: await iconFor(app, budget)});
			}
			return {returnValue: true, apps: apps};
		}); },
		inputs: function () { return shared('inputs', async function () {
			var data = await readLuna('luna://com.webos.service.eim/getAllInputStatus');
			if (!Array.isArray(data.devices)) throw new Error('Input list missing');
			return {returnValue: true, maxHdmiCount: data.maxHdmiCount, devices: data.devices.map(function (device) {
				if (!device || typeof device !== 'object') throw new Error('Incomplete input list');
				return {id: device.id, appId: device.appId, label: device.label, port: device.port,
					hdmiPlugIn: device.hdmiPlugIn, connected: device.connected, hdmiSignalExist: device.hdmiSignalExist};
			})};
		}); }
	};
};
