import {afterEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {canUninstall, uninstallApp} from '../src/service/manage.ts';
const app = {id: 'regional.rakuten.app', title: 'Rakuten TV', color: '#8ea2ff', removable: true};
afterEach(() => {delete (globalThis as {window?: unknown}).window;});
function setup(response: object) {
	const requests: {uri: string; params: unknown}[] = [];
	globalThis.window = {PalmServiceBridge: class {
		onservicecallback: ((s: string) => void) | null = null;
		call(uri: string, params: string) {requests.push({uri, params: JSON.parse(params)}); queueMicrotask(() => this.onservicecallback?.(JSON.stringify(response)));}
		cancel() {}
	}} as unknown as Window & typeof globalThis;
	return requests;
}
test('uninstall sends only the selected removable app to Homebrew and waits for completion', async () => {
	const requests = setup({returnValue: true, statusText: 'Finished.'});
	await uninstallApp(app);
	assert.deepEqual(requests, [{uri: 'luna://org.webosbrew.hbchannel.service/uninstall', params: {id: 'regional.rakuten.app'}}]);
});
test('inputs, Settings, launcher and unknown permissions cannot be uninstalled', async () => {
	const requests = setup({returnValue: true, statusText: 'Finished.'});
	for (const target of [{...app, removable: undefined}, {...app, id: 'tld.my.customhome'}, {...app, launchType: 'input' as const}, {...app, launchType: 'internal' as const}]) {
		assert.equal(canUninstall(target), false);
		await assert.rejects(uninstallApp(target));
	}
	assert.deepEqual(requests, []);
});
test('failed or unconfirmed removal cannot be reported as a successful uninstall', async () => {
	for (const response of [{returnValue: false, errorText: 'Denied'}, {returnValue: true}]) {
		setup(response); await assert.rejects(uninstallApp(app));
	}
});
