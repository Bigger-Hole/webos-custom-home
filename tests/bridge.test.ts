import {afterEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {scanApps, scanInputs} from '../src/service/library.ts';

function bridgeWith(responses: Record<string, object>) {
	const requested: string[] = [];
	globalThis.window = {PalmServiceBridge: class {
		onservicecallback: ((s: string) => void) | null = null;
		call(uri: string) {
			requested.push(uri);
			const response = responses[uri];
			assert.ok(response, `Unexpected request: ${uri}`);
			queueMicrotask(() => this.onservicecallback?.(JSON.stringify(response)));
		}
		cancel() {}
	}} as unknown as Window & typeof globalThis;
	return requested;
}

afterEach(() => {delete (globalThis as {window?: unknown}).window;});

test('app discovery prefers the registered service so actual icon data reaches the tiles', async () => {
	const calls = bridgeWith({'luna://tld.my.customhome.service/discoverApps': {returnValue: true, apps: [{id: 'io.strem.tv', title: 'Stremio', icon: 'data:image/png;base64,iVBORw0KGgo='}]}});
	const apps = await scanApps();
	assert.equal(apps[0]?.icon, 'data:image/png;base64,iVBORw0KGgo=');
	assert.deepEqual(calls, ['luna://tld.my.customhome.service/discoverApps']);
});

test('direct launch-point discovery remains a fallback when the service is unavailable', async () => {
	bridgeWith({
		'luna://tld.my.customhome.service/discoverApps': {returnValue: false},
		'luna://com.webos.applicationManager/listLaunchPoints': {returnValue: true, launchPoints: [{id: 'io.strem.tv', title: 'Stremio'}]}
	});
	assert.equal((await scanApps())[0]?.id, 'io.strem.tv');
});

test('input discovery falls back to the TV input API and still includes disconnected ports', async () => {
	bridgeWith({
		'luna://tld.my.customhome.service/discoverInputs': {returnValue: false},
		'luna://com.webos.service.eim/getAllInputStatus': {returnValue: true, maxHdmiCount: 2, devices: []}
	});
	assert.deepEqual((await scanInputs()).map(a => a.id), ['com.webos.app.hdmi1', 'com.webos.app.hdmi2']);
});

test('denied bridge calls reject instead of erasing the cached library', async () => {
	bridgeWith({
		'luna://tld.my.customhome.service/discoverApps': {returnValue: false},
		'luna://com.webos.applicationManager/listLaunchPoints': {returnValue: false}
	});
	await assert.rejects(scanApps());
});
