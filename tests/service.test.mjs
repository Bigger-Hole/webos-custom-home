import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, mkdir, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {createDiscovery} = createRequire(import.meta.url)('../service/discovery.js');

function lunaFixture(response, method) {
	return (command, args, options, callback) => {
		assert.equal(command, '/usr/bin/luna-send');
		assert.deepEqual(args, ['-n', '1', '-w', '3500', method, '{}']);
		assert.equal(options.shell, undefined);
		queueMicrotask(() => callback(null, JSON.stringify(response)));
	};
}

test('service scans installed apps using a fixed read-only API and returns sandbox-safe raster icons', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'home-icons-'));
	try {
		await mkdir(path.join(root, 'app'));
		await writeFile(path.join(root, 'app', 'icon.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		const discover = createDiscovery({iconRoots: [root], execFile: lunaFixture({returnValue: true, apps: [
			{id: 'io.strem.tv', title: 'Stremio', folderPath: path.join(root, 'app'), icon: 'icon.png'},
			{id: 'invisible', title: 'Helper', visible: false}
		]}, 'luna://com.webos.applicationManager/listApps')});
		const result = await discover.apps();
		assert.deepEqual(result.apps.map(a => a.id), ['io.strem.tv']);
		assert.equal(result.apps[0].icon, 'data:image/png;base64,iVBORw0KGgo=');
		assert.equal(result.apps[0].folderPath, undefined);
	} finally { await rm(root, {recursive: true, force: true}); }
});

test('icon handling rejects path traversal, symlink escapes, SVGs and oversized files', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'home-icons-'));
	try {
		const app = path.join(root, 'apps', 'app');
		await mkdir(app, {recursive: true});
		await writeFile(path.join(root, 'secret.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		await symlink(path.join(root, 'secret.png'), path.join(app, 'link.png'));
		await writeFile(path.join(app, 'bad.svg'), '<svg/>');
		await writeFile(path.join(app, 'big.png'), Buffer.alloc(300_000));
		const apps = ['../../secret.png', 'link.png', 'bad.svg', 'big.png'].map((icon, i) => ({id: 'app' + i, title: 'App ' + i, folderPath: app, icon}));
		const result = await createDiscovery({iconRoots: [path.join(root, 'apps')], execFile: lunaFixture({returnValue: true, apps}, 'luna://com.webos.applicationManager/listApps')}).apps();
		assert.equal(result.apps.length, 4);
		assert.ok(result.apps.every(a => !a.icon));
	} finally { await rm(root, {recursive: true, force: true}); }
});

test('input discovery returns hardware counts and statuses without exposing unrelated device metadata', async () => {
	const result = await createDiscovery({execFile: lunaFixture({returnValue: true, maxHdmiCount: 2, devices: [
		{id: 'HDMI_2', appId: 'com.webos.app.hdmi2', label: 'Soundbar', hdmiPlugIn: true, hdmiSignalExist: false, subList: [{unneeded: 'private metadata'}]}
	]}, 'luna://com.webos.service.eim/getAllInputStatus')}).inputs();
	assert.equal(result.maxHdmiCount, 2);
	assert.equal(result.devices[0].label, 'Soundbar');
	assert.equal(result.devices[0].hdmiPlugIn, true);
	assert.equal(result.devices[0].subList, undefined);
});

test('failed or malformed Luna output rejects a scan instead of returning an empty successful scan', async () => {
	for (const output of ['not JSON', '{"returnValue":false,"errorText":"denied"}', '{"returnValue":true}', '{"apps":[{}]}']) {
		const discover = createDiscovery({execFile: (_cmd, _args, _opts, cb) => cb(null, output)});
		await assert.rejects(discover.apps());
	}
	await assert.rejects(createDiscovery({execFile: (_cmd, _args, _opts, cb) => cb(Error('timeout'))}).inputs());
});
