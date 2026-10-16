import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLists, saveOrders, loadHidden, saveHidden} from '../src/lib/order.ts';

const storage = new Map<string, string>();
globalThis.localStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => { storage.set(key, value); },
	removeItem: (key: string) => { storage.delete(key); }
} as Storage;
beforeEach(() => storage.clear());
const stremio = {id: 'io.strem.tv', title: 'Stremio', color: '#8e5eff', category: 'stream' as const};
const prime = {id: 'amazon', title: 'Prime Video', color: '#00a8e1', category: 'stream' as const};
const hdmi = {id: 'com.webos.app.hdmi2', title: 'Samsung Sound Bar', color: '#8ea2ff', launchType: 'input' as const, category: 'game' as const};

test('only discovered apps and the permanent Settings shortcut appear', () => {
	const lists = buildLists([stremio]);
	assert.deepEqual(lists.stream.map(a => a.id), ['io.strem.tv']);
	assert.deepEqual(lists.game, []);
	assert.deepEqual(lists.misc.map(a => a.id), ['internal.settings']);
});

test('rescanning preserves manual categories and hides without reviving uninstalled apps', () => {
	saveOrders({stream: [prime], media: [stremio]});
	saveHidden(new Set(['io.strem.tv']));
	const lists = buildLists([stremio]);
	assert.deepEqual(lists.stream, []);
	assert.deepEqual(lists.media.map(a => a.id), ['io.strem.tv']);
	assert.equal(loadHidden().has('io.strem.tv'), true);
});

test('temporarily absent apps retain their ordering preferences for a reinstall', () => {
	saveOrders({stream: [prime, stremio]});
	saveOrders(buildLists([stremio]));
	assert.deepEqual(buildLists([stremio, prime]).stream.map(a => a.id), ['amazon', 'io.strem.tv']);
});

test('old Gaming assignments migrate apps back to their app category and keep inputs separate', () => {
	storage.set('home-app-order-v1', JSON.stringify({game: ['io.strem.tv'], media: ['com.webos.app.hdmi2']}));
	const lists = buildLists([stremio, hdmi]);
	assert.deepEqual(lists.game.map(a => a.id), ['com.webos.app.hdmi2']);
	assert.deepEqual(lists.stream.map(a => a.id), ['io.strem.tv']);
	assert.deepEqual(lists.media, []);
});

test('corrupted preferences cannot break startup or hide Settings', () => {
	storage.set('home-app-order-v1', JSON.stringify({stream: null, misc: 42}));
	storage.set('home-hidden-v1', '["internal.settings",42]');
	assert.deepEqual(buildLists([stremio]).stream.map(a => a.id), ['io.strem.tv']);
	assert.deepEqual([...loadHidden()], []);
});
