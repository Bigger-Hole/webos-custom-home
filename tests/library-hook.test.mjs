import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as discovery from '../src/lib/discovery.ts';

test('a scan begun before confirmed removal cannot put the removed app back', async () => {
	const storage = new Map();
	globalThis.localStorage = {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v)};
	const oldApp = {id: 'example.app', title: 'Example', category: 'misc', color: '#8ea2ff', removable: true};
	discovery.saveLibrary({apps: [oldApp]});
	const states = [], refs = [], scans = [];
	let stateIndex, refIndex;
	const react = {
		useState(initial) {const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => {states[index] = typeof next === 'function' ? next(states[index]) : next;}];},
		useRef(initial) {return refs[refIndex++] ??= {current: initial};},
		useCallback(fn) {return fn;},
		useEffect() {} // Automatic scheduling is irrelevant; drive the real manual scan here.
	};
	const transport = {scanApps: () => new Promise(resolve => scans.push(resolve)), scanInputs: async () => []};
	const code = ts.transpileModule(fs.readFileSync(new URL('../src/hooks/useLibrary.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
	const module = {exports: {}};
	vm.runInNewContext(code, {module, exports: module.exports, require: name => {
		if (name === 'react') return react;
		if (name === '../lib/discovery') return discovery;
		if (name === '../service/library') return transport;
		if (name === '../service/luna') return {isWebOS: () => true};
		throw Error(name);
	}});
	const render = () => {stateIndex = refIndex = 0; return module.exports.useLibrary();};
	const library = render();
	const scan = library.rescan();
	const removal = library.forgetApp(oldApp.id);
	scans.shift()([oldApp]);
	await scan; await removal;
	assert.deepEqual(render().snapshot.apps, []);
	const fresh = render().rescan();
	scans.shift()([]); await fresh;
	assert.deepEqual(render().snapshot.apps, []);
});
