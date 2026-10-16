import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeApps, normalizeInputs, mergeScan, inputStatus, reconcileSelection, loadLibrary, saveLibrary} from '../src/lib/discovery.ts';

const store = new Map<string, string>();
globalThis.localStorage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => {store.set(k, v);}} as Storage;
beforeEach(() => store.clear());
const stremio = {id: 'io.strem.tv', title: 'Stremio', color: '#8e5eff', category: 'stream' as const};
const prime = {id: 'amazon', title: 'Prime Video', color: '#00a8e1', category: 'stream' as const};
const rawApps = {returnValue: true, apps: [
	{id: 'amazon', title: 'Prime Video'}, {id: 'bbc.iplayer.3.0', title: 'BBC iPlayer'},
	{id: 'io.strem.tv', title: 'Stremio'}, {id: 'com.fvp.itv', title: 'ITVX'},
	{id: 'youtube.leanback.v4', title: 'YouTube AdFree'}, {id: 'spotify-beehive', title: 'Spotify - Music and Podcasts'},
	{id: 'org.webosbrew.inputhook', title: 'LG Input Hook'}, {id: 'com.example.new', title: 'New App'},
	{id: 'hidden.helper', title: 'Background helper', visible: false},
	{id: 'other.helper', title: 'Other helper', class: {hidden: true}},
	{id: 'tld.my.customhome', title: 'Custom Home'}, {id: 'com.webos.app.hdmi1', title: 'HDMI 1'}
]};
const rawInputs = {returnValue: true, maxHdmiCount: 4, devices: [
	{port: 1, id: 'HDMI_1', appId: 'com.webos.app.hdmi1', label: 'HDMI 1', hdmiPlugIn: true, connected: true, hdmiSignalExist: true},
	{port: 2, id: 'HDMI_2', appId: 'com.webos.app.hdmi2', label: 'Samsung Sound Bar', hdmiPlugIn: true, connected: true, hdmiSignalExist: false},
	{port: 3, id: 'HDMI_3', appId: 'com.webos.app.hdmi3', label: 'HDMI 3', hdmiPlugIn: false, connected: false, hdmiSignalExist: false},
	{port: 4, id: 'HDMI_4', appId: 'com.webos.app.hdmi4', label: 'HDMI 4', hdmiPlugIn: false, connected: true, hdmiSignalExist: false}
]};

test('installed launchable apps are classified locally and unfamiliar apps go to Misc', () => {
	const apps = normalizeApps(rawApps);
	assert.deepEqual(apps.filter(a => a.category === 'stream').map(a => a.id).sort(), ['amazon', 'bbc.iplayer.3.0', 'com.fvp.itv', 'io.strem.tv']);
	assert.deepEqual(apps.filter(a => a.category === 'media').map(a => a.id).sort(), ['spotify-beehive', 'youtube.leanback.v4']);
	assert.deepEqual(apps.filter(a => a.category === 'misc').map(a => a.id).sort(), ['com.example.new', 'org.webosbrew.inputhook']);
	assert.equal(apps[0].id, 'io.strem.tv');
});

test('duplicate launch points create one tile and actual TV titles are retained', () => {
	const apps = normalizeApps({launchPoints: [{id: 'youtube.leanback.v4', title: 'YouTube AdFree'}, {id: 'youtube.leanback.v4', title: 'Duplicate'}]});
	assert.equal(apps.length, 1);
	assert.equal(apps[0].title, 'YouTube AdFree');
});

test('malformed scans are rejected rather than treated as an uninstall of everything', () => {
	for (const response of [{returnValue: false, apps: []}, {}, {apps: [{}]}, {apps: null}]) {
		assert.throws(() => normalizeApps(response));
	}
	assert.deepEqual(normalizeApps({apps: []}), []);
	assert.throws(() => normalizeInputs({devices: null}));
});

test('unknown app artwork cannot inject remote URLs or active SVG content', () => {
	for (const icon of ['https://tracker.invalid/icon.png', 'file:///etc/passwd', 'data:image/svg+xml;base64,PHN2Zz4=']) {
		assert.equal(normalizeApps({apps: [{id: 'unknown', title: 'Unknown', icon} ]})[0]?.icon, undefined);
	}
});

test('all HDMI ports use TV labels and distinguish a cable from a video signal', () => {
	const inputs = normalizeInputs(rawInputs);
	assert.deepEqual(inputs.map(a => a.id), ['com.webos.app.hdmi1', 'com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'com.webos.app.hdmi4']);
	assert.equal(inputs[1].title, 'Samsung Sound Bar');
	assert.deepEqual(inputs.map(inputStatus), ['HDMI 1 · Signal detected', 'HDMI 2 · Connected · no signal', 'HDMI 3 · Not connected', 'HDMI 4 · Not connected']);
	assert.ok(inputs.every(a => a.launchType === 'input' && a.category === 'game'));
});

test('missing HDMI entries stay available with unknown status, without inventing console names', () => {
	const inputs = normalizeInputs({returnValue: true, maxHdmiCount: 2, devices: []});
	assert.deepEqual(inputs.map(a => a.title), ['HDMI 1', 'HDMI 2']);
	assert.equal(inputStatus(inputs[1]), 'HDMI 2 · Status unavailable');
});

test('older input responses without port counts can use HDMI IDs and ignore other device types', () => {
	const inputs = normalizeInputs({devices: [{id: 'HDMI_3', label: 'My console', connected: true}, {id: 'AV_1', port: 1, label: 'AV'}]});
	assert.deepEqual(inputs.map(a => a.id), ['com.webos.app.hdmi3']);
	assert.equal(inputStatus(inputs[0]), 'HDMI 3 · Connected');
});

test('one failed scan retains its cache while the other scan can succeed', () => {
	const inputs = normalizeInputs(rawInputs);
	const merged = mergeScan({apps: [stremio], inputs}, {
		apps: {status: 'rejected', reason: new Error('permissions')}, inputs: {status: 'fulfilled', value: inputs.slice(0, 2)}
	});
	assert.deepEqual(merged.apps, [stremio]);
	assert.equal(merged.inputs?.length, 2);
	const failedInputs = mergeScan(merged, {inputs: {status: 'rejected', reason: new Error('timeout')}});
	assert.equal(inputStatus(failedInputs.inputs![0]), 'HDMI 1 · Status unavailable');
	assert.equal(failedInputs.inputs![1].title, 'Samsung Sound Bar');
});

test('a successful empty app list removes uninstalled apps', () => {
	assert.deepEqual(mergeScan({apps: [stremio]}, {apps: {status: 'fulfilled', value: []}}).apps, []);
});

test('a rescan keeps focus on the same tile when earlier apps are removed or added', () => {
	assert.equal(reconcileSelection([prime, stremio], [stremio], 1, false), 0);
	assert.equal(reconcileSelection([stremio], [prime, stremio], 0, false), 1);
	assert.equal(reconcileSelection([], [prime, stremio], 0, true), 1);
	assert.equal(reconcileSelection([prime], [], 0, true), 0);
});

test('cached app lists survive restart and cached HDMI status is marked unknown', () => {
	saveLibrary({apps: [stremio], inputs: normalizeInputs(rawInputs)});
	const cached = loadLibrary();
	assert.equal(cached.apps?.[0].id, 'io.strem.tv');
	assert.equal(cached.inputs?.[1].title, 'Samsung Sound Bar');
	assert.equal(inputStatus(cached.inputs![0]), 'HDMI 1 · Status unavailable');
});

test('malformed cache and unavailable storage cannot prevent startup', () => {
	store.set('home-library-v1', '{"apps":[{}]}');
	assert.deepEqual(loadLibrary(), {});
	const original = globalThis.localStorage;
	globalThis.localStorage = {getItem: () => {throw Error('blocked');}, setItem: () => {throw Error('quota');}} as unknown as Storage;
	try { assert.deepEqual(loadLibrary(), {}); assert.doesNotThrow(() => saveLibrary({apps: [stremio]})); }
	finally { globalThis.localStorage = original; }
});

test('a malformed input entry cannot erase a successful inventory', () => {
	assert.throws(() => normalizeInputs({returnValue: true, devices: [{}]}));
	assert.throws(() => normalizeInputs({returnValue: true, devices: []}));
});

test('a partial input scan keeps detected labels but marks omitted port status unavailable', () => {
	const previous = {inputs: normalizeInputs(rawInputs)};
	const incomplete = normalizeInputs({returnValue: true, maxHdmiCount: 4, devices: []});
	const merged = mergeScan(previous, {inputs: {status: 'fulfilled', value: incomplete}});
	assert.equal(merged.inputs![1].title, 'Samsung Sound Bar');
	assert.equal(inputStatus(merged.inputs![1]), 'HDMI 2 · Status unavailable');
});

test('count-less partial input updates retain other cached ports with unknown status', () => {
	const merged = mergeScan({inputs: normalizeInputs(rawInputs)}, {inputs: {status: 'fulfilled', value: normalizeInputs({devices: [
		{id: 'HDMI_2', label: 'Samsung Sound Bar', hdmiPlugIn: true}
	]})}});
	assert.equal(merged.inputs?.length, 4);
	assert.equal(inputStatus(merged.inputs![0]), 'HDMI 1 · Status unavailable');
	assert.equal(inputStatus(merged.inputs![1]), 'HDMI 2 · Connected');
});

test('an input entry missing a label preserves its cached label; an explicit reset clears it', () => {
	const previous = {inputs: normalizeInputs(rawInputs)};
	for (const [label, title] of [[undefined, 'Samsung Sound Bar'], ['', 'HDMI 2']] as const) {
		const merged = mergeScan(previous, {inputs: {status: 'fulfilled', value: normalizeInputs({maxHdmiCount: 4, devices: [{id: 'HDMI_2', label, hdmiPlugIn: true}]})}});
		assert.equal(merged.inputs![1].title, title);
	}
});

test('Rakuten TV is classified as Streaming when discovered, without installing a preset tile', () => {
	const apps = normalizeApps({apps: [{id: 'regional.rakuten.app', title: 'Rakuten TV', removable: true}]});
	assert.equal(apps[0].category, 'stream');
	assert.equal(apps[0].removable, true);
	assert.deepEqual(normalizeApps({apps: []}), []);
});

test('unknown removal permission and system apps never acquire an uninstall action', () => {
	const apps = normalizeApps({apps: [{id: 'system.tool', title: 'System Tool', systemApp: true, removable: true}, {id: 'unknown', title: 'Unknown'}]});
	assert.ok(apps.every(app => app.removable === false));
});
