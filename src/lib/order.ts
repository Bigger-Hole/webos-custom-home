import {APPS, type AppItem} from './apps.ts';
import type {ScreenId} from './screens.ts';

export type CatId = Exclude<ScreenId, 'home'>;
export const CATS: CatId[] = ['game', 'stream', 'media', 'misc'];
const ORDER_KEY = 'home-app-order-v1';
const HIDDEN_KEY = 'home-hidden-v1';
const SETTINGS = APPS.misc.find(a => a.id === 'internal.settings')!;
type Orders = Partial<Record<CatId, string[]>>;

function loadOrders (): Orders {
	try {
		const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || '{}');
		const out: Orders = {};
		for (const cat of CATS) {
			if (Array.isArray(raw?.[cat])) out[cat] = raw[cat].filter((id: unknown) => typeof id === 'string');
		}
		return out;
	} catch { return {}; }
}

function categoryFor (app: AppItem): CatId {
	if (app.launchType === 'input') return 'game';
	if (app.launchType === 'internal') return 'misc';
	if (app.category && app.category !== 'game') return app.category;
	return CATS.find(cat => cat !== 'game' && APPS[cat].some(hint => hint.id === app.id)) ?? 'misc';
}

/** Discovery is authoritative; saved preferences arrange only items still present. */
export function buildLists (discovered: AppItem[] = []): Record<CatId, AppItem[]> {
	const byId = new Map(discovered.filter(a => a.id !== 'tld.my.customhome').map(a => [a.id, a]));
	byId.set(SETTINGS.id, SETTINGS);
	const out: Record<CatId, AppItem[]> = {game: [], stream: [], media: [], misc: []};
	const claimed = new Set<string>();
	const saved = loadOrders();
	for (const cat of CATS) {
		for (const id of saved[cat] || []) {
			const app = byId.get(id);
			if (!app || claimed.has(id)) continue;
			// Inputs stay in Display Inputs; old Gaming app placements migrate back.
			if ((cat === 'game') !== (app.launchType === 'input')) continue;
			if (app.launchType === 'internal' && cat !== 'misc') continue;
			out[cat].push(app);
			claimed.add(id);
		}
	}
	for (const app of byId.values()) {
		if (!claimed.has(app.id)) out[categoryFor(app)].push(app);
	}
	return out;
}

/** Keep absent IDs in their previous slots so reinstalling restores preferences. */
export function saveOrders (lists: Partial<Record<CatId, AppItem[]>>): void {
	const all = loadOrders();
	const present = new Set(Object.values(lists).flatMap(apps => apps.map(a => a.id)));
	for (const cat of CATS) {
		const apps = lists[cat];
		if (!apps) continue;
		const pending = apps.map(a => a.id);
		const merged: string[] = [];
		for (const id of all[cat] || []) {
			if (!present.has(id)) merged.push(id);
			else if (pending.length) merged.push(pending.shift()!);
		}
		all[cat] = [...new Set([...merged, ...pending])];
	}
	try { localStorage.setItem(ORDER_KEY, JSON.stringify(all)); } catch { /* best effort */ }
}

export function resetOrder (): void {
	try { localStorage.removeItem(ORDER_KEY); } catch { /* best effort */ }
}

export function loadHidden (): Set<string> {
	try {
		const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
		return new Set(Array.isArray(raw) ? raw.filter(id => typeof id === 'string' && id !== SETTINGS.id) : []);
	} catch { return new Set(); }
}

export function saveHidden (ids: Set<string>): void {
	try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids].filter(id => id !== SETTINGS.id))); } catch { /* best effort */ }
}
