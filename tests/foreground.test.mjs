import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {watchForeground} = createRequire(import.meta.url)('../service/foreground.js');

function harness() {
	const children = [], timers = new Map();
	let next = 0, returns = 0;
	const stop = watchForeground({
		spawn(command, args, options) {
			assert.equal(command, '/usr/bin/luna-send');
			assert.deepEqual(args, ['-i', 'luna://com.webos.applicationManager/getForegroundAppInfo', '{"subscribe":true}']);
			assert.equal(options.shell, undefined);
			const child = new EventEmitter();
			child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => { child.killed = true; };
			children.push(child); return child;
		},
		setTimeout(fn) { const id = ++next; timers.set(id, fn); return id; },
		clearTimeout(id) { timers.delete(id); },
		onHome() { returns++; }, log() {}
	});
	return {children, stop, get returns() {return returns;},
		push(value) { children.at(-1).stdout.emit('data', Buffer.from(JSON.stringify(value) + '\n')); },
		tick() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } }
	};
}

test('returning to LG Home after exiting an app opens Custom Home', () => {
	const h = harness();
	assert.equal(h.children.length, 1);
	h.push({returnValue: true, subscribed: true, appId: 'youtube.leanback.v4'});
	h.push({returnValue: true, appId: 'com.webos.app.home'});
	assert.equal(h.returns, 0); h.tick(); assert.equal(h.returns, 1);
	h.stop();
});

test('a brief LG Home transition cannot steal focus from another app or HDMI input', () => {
	const h = harness();
	assert.equal(h.children.length, 1);
	for (const appId of ['amazon', 'com.webos.app.hdmi1', 'com.webos.app.settings', 'tld.my.customhome']) {
		h.push({returnValue: true, appId: 'com.webos.app.home'});
		h.push({returnValue: true, appId}); h.tick();
	}
	assert.equal(h.returns, 0); h.stop();
});

test('denied or malformed events cannot trigger a home redirect', () => {
	const h = harness();
	assert.equal(h.children.length, 1);
	h.children[0].stdout.emit('data', Buffer.from('not JSON\n'));
	h.push({returnValue: false, appId: 'com.webos.app.home'});
	h.push({returnValue: true}); h.tick();
	assert.equal(h.returns, 0); h.stop();
});

test('subscription output split across stream chunks still redirects once', () => {
	const h = harness();
	assert.equal(h.children.length, 1);
	h.children[0].stdout.emit('data', Buffer.from('{"returnValue":true,"appId":"com.webos.'));
	h.children[0].stdout.emit('data', Buffer.from('app.home"}\n'));
	h.tick(); assert.equal(h.returns, 1); h.stop();
});

test('a dead subscription reconnects; stopping cancels redirects and reconnects', () => {
	const h = harness();
	assert.equal(h.children.length, 1);
	h.children[0].emit('close', 1); h.tick();
	assert.equal(h.children.length, 2);
	h.push({returnValue: true, appId: 'com.webos.app.home'});
	h.stop(); h.tick();
	assert.equal(h.returns, 0);
	assert.equal(h.children[1].killed, true);
});
