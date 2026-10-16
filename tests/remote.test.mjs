import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as screens from '../src/lib/screens.ts';

// Execute the real hook; substitute only React's lifecycle and the browser clock.
// This makes refresh races deterministic without waiting for a physical remote.
function remoteHarness() {
	const code = ts.transpileModule(fs.readFileSync(new URL('../src/hooks/useRemoteNav.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
	const refs = [], effects = [], listeners = new Map(), timers = new Map();
	let refIndex = 0, effectIndex = 0, nextTimer = 1;
	const counts = {launch: 0, move: 0};
	const react = {
		useRef(value) { return refs[refIndex++] ??= {current: value}; },
		useEffect(fn, deps) {
			const index = effectIndex++, old = effects[index];
			if (old && deps.length === old.deps.length && deps.every((v, i) => Object.is(v, old.deps[i]))) return;
			old?.cleanup?.();
			effects[index] = {deps, cleanup: fn()};
		}
	};
	const browser = {
		setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; },
		clearTimeout(id) { timers.delete(id); },
		addEventListener(type, fn) { listeners.set(type, fn); },
		removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
	};
	const module = {exports: {}};
	vm.runInNewContext(code, {exports: module.exports, module, window: browser,
		require: name => { if (name === 'react') return react; if (name === '../lib/screens') return screens; throw Error(name); }});
	const defaults = {screen: 'stream', selected: 0, selectedId: 'io.strem.tv', itemCount: 2, enabled: true, moving: false,
		setScreen() {}, setSelected() {}, onLaunch() { counts.launch++; }, onMoveStart() { counts.move++; },
		onMoveStep() {}, onMoveCross() {}, onMoveCommit() {}, onMoveCancel() {}};
	return {
		counts,
		render(overrides = {}) { refIndex = effectIndex = 0; module.exports.useRemoteNav({...defaults, ...overrides}); },
		key(type, key = 'Enter') { listeners.get(type)?.({key, repeat: false, preventDefault() {}}); },
		hold() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } }
	};
}

test('a refresh during an OK hold still enters move mode instead of launching', () => {
	const h = remoteHarness();
	h.render(); h.key('keydown');
	h.render({onLaunch() { h.counts.launch++; }}); // fresh callback identities after a scan
	h.hold(); h.key('keyup');
	assert.deepEqual(h.counts, {move: 1, launch: 0});
});

test('removing the pressed tile during a scan cannot launch its replacement', () => {
	const h = remoteHarness();
	h.render(); h.key('keydown');
	h.render({selectedId: 'amazon'}); h.key('keyup');
	assert.equal(h.counts.launch, 0);
});

test('a normal short OK press launches exactly once', () => {
	const h = remoteHarness();
	h.render(); h.key('keydown'); h.key('keyup');
	assert.deepEqual(h.counts, {move: 0, launch: 1});
});

test('opening an overlay cancels a pending hold and prevents a stray release launch', () => {
	const h = remoteHarness();
	h.render(); h.key('keydown'); h.render({enabled: false}); h.hold();
	h.render(); h.key('keyup');
	assert.deepEqual(h.counts, {move: 0, launch: 0});
});
