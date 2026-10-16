import {useCallback, useEffect, useRef, useState} from 'react';
import {loadLibrary, mergeScan, saveLibrary, type LibrarySnapshot} from '../lib/discovery';
import {scanApps, scanInputs} from '../service/library';
import {isWebOS} from '../service/luna';

type Part = 'apps' | 'inputs';
export function useLibrary () {
	const [snapshot, setSnapshot] = useState<LibrarySnapshot>(loadLibrary);
	const current = useRef(snapshot);
	const active = useRef(true);
	const pending = useRef<Partial<Record<Part, Promise<boolean>>>>({});
	const appGeneration = useRef(0);
	const [scanning, setScanning] = useState({apps: false, inputs: false});
	const [errors, setErrors] = useState<Partial<Record<Part, string>>>({});

	const scan = useCallback((part: Part): Promise<boolean> => {
		if (pending.current[part]) return pending.current[part]!;
		if (!isWebOS()) {
			setErrors(prev => ({...prev, [part]: 'Open on a webOS TV to scan'}));
			return Promise.resolve(false);
		}
		setScanning(prev => ({...prev, [part]: true}));
		const generation = appGeneration.current;
		const job = (part === 'apps' ? scanApps() : scanInputs()).then(items => {
			if (!active.current || (part === 'apps' && generation !== appGeneration.current)) return false;
			current.current = mergeScan(current.current, {[part]: {status: 'fulfilled', value: items}});
			saveLibrary(current.current);
			setSnapshot(current.current);
			setErrors(prev => ({...prev, [part]: undefined}));
			return true;
		}).catch(() => {
			if (!active.current || (part === 'apps' && generation !== appGeneration.current)) return false;
			current.current = mergeScan(current.current, {[part]: {status: 'rejected', reason: 'unavailable'}});
			setSnapshot(current.current);
			setErrors(prev => ({...prev, [part]: 'Scan unavailable — keeping saved results'}));
			return false;
		}).finally(() => {
			delete pending.current[part];
			if (active.current) setScanning(prev => ({...prev, [part]: false}));
		});
		pending.current[part] = job;
		return job;
	}, []);
	const rescan = useCallback(async () => {
		const [apps, inputs] = await Promise.all([scan('apps'), scan('inputs')]);
		return apps && inputs;
	}, [scan]);
	const forgetApp = useCallback(async (id: string) => {
		appGeneration.current++;
		current.current = {...current.current, apps: current.current.apps?.filter(app => app.id !== id)};
		saveLibrary(current.current);
		setSnapshot(current.current);
		// Let an older read finish before a post-removal rescan can share its
		// service promise. Its result is ignored by the generation check above.
		await pending.current.apps;
	}, []);

	useEffect(() => {
		active.current = true;
		if (!isWebOS()) return () => { active.current = false; };
		void rescan();
		const refresh = () => { if (!document.hidden) void rescan(); };
		const appTimer = window.setInterval(() => { if (!document.hidden) void scan('apps'); }, 60_000);
		const inputTimer = window.setInterval(() => { if (!document.hidden) void scan('inputs'); }, 10_000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			active.current = false;
			window.clearInterval(appTimer);
			window.clearInterval(inputTimer);
			document.removeEventListener('visibilitychange', refresh);
		};
	}, [rescan, scan]);
	return {snapshot, rescan, scanning, errors, forgetApp};
}
