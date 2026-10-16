import {APPS, type AppItem, type AppCategory} from './apps.ts';

export interface LibrarySnapshot {apps?: AppItem[]; inputs?: AppItem[]}
export interface ScanResults {apps?: PromiseSettledResult<AppItem[]>; inputs?: PromiseSettledResult<AppItem[]>}
const CACHE_KEY = 'home-library-v1';
const hints = new Map(Object.entries(APPS).flatMap(([category, apps]) =>
	apps.map((app, rank) => [app.id, {...app, category: category as AppCategory, rank}] as const)
));
const extraCategories: Record<string, AppCategory> = {
	'bbc.iplayer.3.0': 'stream', 'com.fvp.itv': 'stream', 'com.channel4.4od': 'stream',
	'com.channel5.my5': 'stream', 'com.webos.app.lgchannels': 'stream',
	'com.webos.app.mediadiscovery': 'media', 'youtube.leanback.v3': 'media'
};
const titleCategories: Record<string, AppCategory> = {
	'bbc iplayer': 'stream', 'itvx': 'stream', 'channel 4': 'stream', 'my5': 'stream',
	'rakuten tv': 'stream',
	'plex': 'media', 'jellyfin': 'media', 'emby': 'media', 'youtube': 'media',
	'youtube adfree': 'media', 'spotify': 'media', 'twitch': 'media'
};
function object (value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid discovery response');
	return value as Record<string, unknown>;
}
function responseObject (value: unknown) {
	const data = object(value);
	if (data.returnValue === false) throw new Error('Discovery unavailable');
	return data;
}
function rasterIcon (value: unknown): string | undefined {
	return typeof value === 'string' && value.length <= 360_000
		&& /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;
}

/** Use only launchable apps supplied by the TV; hints never add absent apps. */
export function normalizeApps (response: unknown): AppItem[] {
	const data = responseObject(response);
	const raw = data.apps ?? data.launchPoints;
	if (!Array.isArray(raw)) throw new Error('App list missing');
	const apps = new Map<string, AppItem>();
	for (const value of raw) {
		const entry = object(value);
		if (typeof entry.id !== 'string' || !entry.id || typeof entry.title !== 'string' || !entry.title.trim()) {
			throw new Error('Incomplete app list');
		}
		const id = entry.id;
		if (entry.visible === false || (entry.class as {hidden?: boolean} | undefined)?.hidden === true
			|| id === 'tld.my.customhome' || id === 'internal.settings' || /^com\.webos\.app\.hdmi\d+$/.test(id) || apps.has(id)) continue;
		const hint = hints.get(id);
		const category = hint?.category ?? extraCategories[id] ?? titleCategories[entry.title.trim().toLowerCase()] ?? 'misc';
		apps.set(id, {
			id, title: entry.title.trim(), category, color: hint?.color ?? '#8ea2ff',
			icon: rasterIcon(entry.icon) ?? hint?.icon, launchType: 'app',
			removable: entry.removable === true && entry.systemApp !== true
		});
	}
	return [...apps.values()].sort((a, b) =>
		(hints.get(a.id)?.rank ?? 1000) - (hints.get(b.id)?.rank ?? 1000) || a.title.localeCompare(b.title)
	);
}

/** Plug state takes precedence over LG's sometimes-stale `connected` flag. */
export function normalizeInputs (response: unknown): AppItem[] {
	const data = responseObject(response);
	if (!Array.isArray(data.devices)) throw new Error('Input list missing');
	const devices = new Map<number, Record<string, unknown>>();
	for (const value of data.devices) {
		const device = object(value);
		const idMatch = typeof device.id === 'string' ? /^HDMI_(\d+)$/i.exec(device.id) : null;
		const appMatch = typeof device.appId === 'string' ? /^com\.webos\.app\.hdmi(\d+)$/.exec(device.appId) : null;
		const match = idMatch ?? appMatch;
		if (!match) {
			if (typeof device.id !== 'string' && typeof device.appId !== 'string') throw new Error('Incomplete input entry');
			continue;
		}
		const port = Number(match[1]);
		if (Number.isInteger(port) && port >= 1 && port <= 16) devices.set(port, device);
	}
	const hasCount = typeof data.maxHdmiCount === 'number' && Number.isInteger(data.maxHdmiCount)
		&& data.maxHdmiCount >= 0 && data.maxHdmiCount <= 16;
	if (data.maxHdmiCount !== undefined && !hasCount) throw new Error('Invalid HDMI port count');
	if (!hasCount && !devices.size) throw new Error('HDMI inventory unavailable');
	const count = hasCount ? data.maxHdmiCount as number : 0;
	for (let port = 1; port <= count; port++) if (!devices.has(port)) devices.set(port, {});
	return [...devices].sort(([a], [b]) => a - b).map(([port, device]) => {
		const connected = typeof device.hdmiPlugIn === 'boolean' ? device.hdmiPlugIn
			: typeof device.connected === 'boolean' ? device.connected : undefined;
		const signal = typeof device.hdmiSignalExist === 'boolean' ? device.hdmiSignalExist : undefined;
		return {
			id: `com.webos.app.hdmi${port}`, title: typeof device.label === 'string' && device.label.trim() ? device.label.trim() : `HDMI ${port}`,
			color: '#b39cff', launchType: 'input', category: 'game',
			input: {port, connected, signal, stale: !Object.keys(device).length, labelReported: typeof device.label === 'string', portCount: hasCount ? count : undefined}
		};
	});
}

export function mergeScan (previous: LibrarySnapshot, results: ScanResults): LibrarySnapshot {
	const next = {...previous};
	if (results.apps?.status === 'fulfilled') next.apps = results.apps.value;
	if (results.inputs?.status === 'fulfilled') {
		const previousById = new Map(previous.inputs?.map(app => [app.id, app]));
		next.inputs = results.inputs.value.map(app => app.input?.labelReported === false && previousById.has(app.id)
			? {...app, title: previousById.get(app.id)!.title} : app);
		// Older firmware may return only changed ports without a hardware count.
		// Missing ports in that response are unknown, not removed from the TV.
		if (next.inputs.length && next.inputs.every(app => app.input?.portCount === undefined)) {
			const reported = new Set(next.inputs.map(app => app.id));
			for (const app of previous.inputs || []) {
				if (!reported.has(app.id)) next.inputs.push({...app, input: {...app.input!, stale: true}});
			}
			next.inputs.sort((a, b) => a.input!.port - b.input!.port);
		}
	}
	else if (results.inputs?.status === 'rejected' && previous.inputs) {
		next.inputs = previous.inputs.map(app => ({...app, input: {...app.input!, stale: true}}));
	}
	return next;
}

export function inputStatus (app: AppItem): string {
	const input = app.input;
	if (!input) return '';
	const prefix = `HDMI ${input.port} · `;
	if (input.stale) return prefix + 'Status unavailable';
	if (input.signal === true) return prefix + 'Signal detected';
	if (input.connected === false) return prefix + 'Not connected';
	if (input.connected === true) return prefix + (input.signal === false ? 'Connected · no signal' : 'Connected');
	return prefix + 'Status unavailable';
}

export function reconcileSelection (before: AppItem[], after: AppItem[], index: number, nearEnd: boolean): number {
	if (!after.length) return 0;
	const selectedId = before[index]?.id;
	const found = selectedId ? after.findIndex(a => a.id === selectedId) : -1;
	if (found >= 0) return found;
	if (!before.length) return nearEnd ? after.length - 1 : 0;
	return Math.max(0, Math.min(index, after.length - 1));
}

function validCacheItems (value: unknown, inputs: boolean): value is AppItem[] {
	return Array.isArray(value) && value.every(item => item && typeof item.id === 'string'
		&& typeof item.title === 'string' && /^#[0-9a-f]{6}$/i.test(item.color)
		&& ['game', 'stream', 'media', 'misc'].includes(item.category)
		&& (inputs ? item.launchType === 'input' && Number.isInteger(item.input?.port) && item.input.port >= 1 && item.input.port <= 16
			: item.launchType === undefined || item.launchType === 'app'));
}
export function loadLibrary (): LibrarySnapshot {
	try {
		const data = object(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'));
		const snapshot: LibrarySnapshot = {};
		if (validCacheItems(data.apps, false)) snapshot.apps = data.apps;
		if (validCacheItems(data.inputs, true)) snapshot.inputs = data.inputs.map(app => ({...app, input: {...app.input!, stale: true}}));
		return snapshot;
	} catch { return {}; }
}
export function saveLibrary (snapshot: LibrarySnapshot): void {
	try {
		// Raster data can exceed localStorage quotas; retain metadata and bundled art.
		const apps = snapshot.apps?.map(app => ({...app, icon: hints.get(app.id)?.icon}));
		localStorage.setItem(CACHE_KEY, JSON.stringify({...snapshot, apps}));
	} catch { /* Storage failures must not interrupt TV navigation. */ }
}
