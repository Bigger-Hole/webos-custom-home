import {useCallback, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {APP_VERSION, type HomeConfig} from '../lib/config';
import {resetOrder, CATS, type CatId} from '../lib/order';
import {SCREENS} from '../lib/screens';
import type {AppItem} from '../lib/apps';
import {searchCity, type GeoResult} from '../service/weather';
import {canUninstall} from '../service/manage';
import UninstallDialog from './UninstallDialog';

// Remote-driven settings overlay (QOL config GUI). Up/Down picks a row,
// Left/Right cycles its value (saved immediately by App), OK fires actions,
// Back closes (or leaves a sub-pane). No blur (TV GPU).

const ACCENT = '#7ca8ff';

type Row =
	| {kind: 'choice'; label: string; values: string[]; labels: string[]; get: (c: HomeConfig) => string; set: (c: HomeConfig, v: string) => HomeConfig}
	| {kind: 'action'; label: string; hint: string; action: 'reset' | 'apps' | 'rescan'}
	| {kind: 'location'; label: string}
	| {kind: 'info'; label: string; value: string};

const ROWS: Row[] = [
	{
		kind: 'choice', label: 'Clock format', values: ['12', '24'], labels: ['12-hour', '24-hour'],
		get: (c) => (c.clock24 ? '24' : '12'), set: (c, v) => ({...c, clock24: v === '24'})
	},
	{
		kind: 'choice', label: 'Temperature', values: ['fahrenheit', 'celsius'], labels: ['°F', '°C'],
		get: (c) => c.tempUnit, set: (c, v) => ({...c, tempUnit: v as HomeConfig['tempUnit']})
	},
	{kind: 'location', label: 'Location'},
	{
		kind: 'choice', label: 'Background animation', values: ['on', 'off'], labels: ['On', 'Off'],
		get: (c) => (c.bgAnimated ? 'on' : 'off'), set: (c, v) => ({...c, bgAnimated: v === 'on'})
	},
	{
		kind: 'choice', label: 'Color theme', values: ['classic', 'mono', 'ember', 'aurora'], labels: ['Classic', 'Mono Blue', 'Ember', 'Aurora'],
		get: (c) => c.bgTheme, set: (c, v) => ({...c, bgTheme: v as HomeConfig['bgTheme']})
	},
	{
		kind: 'choice', label: 'Star density', values: ['low', 'normal', 'high'], labels: ['Low', 'Normal', 'High'],
		get: (c) => c.bgDensity, set: (c, v) => ({...c, bgDensity: v as HomeConfig['bgDensity']})
	},
	{
		kind: 'choice', label: 'Motion speed', values: ['slow', 'normal', 'fast'], labels: ['Slow', 'Normal', 'Fast'],
		get: (c) => c.bgSpeed, set: (c, v) => ({...c, bgSpeed: v as HomeConfig['bgSpeed']})
	},
	{kind: 'action', label: 'Manage apps', hint: 'OK to open', action: 'apps'},
	{kind: 'action', label: 'Rescan apps and inputs', hint: 'OK to scan', action: 'rescan'},
	{kind: 'action', label: 'Reset app order', hint: 'OK to reset', action: 'reset'},
	{kind: 'info', label: 'Version', value: `v${APP_VERSION}`}
];

const LOCATION_ROW = ROWS.findIndex((r) => r.kind === 'location');
const APPS_ROW = ROWS.findIndex((r) => r.kind === 'action' && r.action === 'apps');

// Manage-apps pane: every app across all categories; OK (handled by the parent
// key handler) toggles shown/hidden.
function AppsPane ({lists, hidden, row, action, onToggleHide, onUninstall}: {
	lists: Record<CatId, AppItem[]>; hidden: Set<string>; row: number; action: 'visibility' | 'uninstall';
	onToggleHide: (id: string) => void; onUninstall: (app: AppItem) => void;
}) {
	const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
	useEffect(() => { rowRefs.current[row]?.scrollIntoView({block: 'nearest'}); }, [row]);

	let i = -1;
	return (
		<div className="flex max-h-[52vh] flex-col gap-1 overflow-hidden overflow-y-auto pr-2">
			{CATS.map((cat) => (
				<div key={cat}>
					<div className="px-6 pb-1 pt-3 text-sm font-semibold uppercase tracking-widest" style={{color: SCREENS[cat].accent}}>
						{SCREENS[cat].label}
					</div>
					{lists[cat].map((app) => {
						i++;
						const idx = i;
						const focused = idx === row;
						const isHidden = hidden.has(app.id);
						return (
							<div
								key={app.id}
								ref={(el) => { rowRefs.current[idx] = el; }}
								className="flex items-center justify-between rounded-2xl px-6 py-2.5"
								style={{
									background: focused ? `${ACCENT}1f` : 'transparent',
									border: `1px solid ${focused ? `${ACCENT}66` : 'transparent'}`
								}}
							>
								<span className="min-w-0 truncate pr-3 text-lg font-medium" style={{color: isHidden ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.92)'}}>
									{app.title}
								</span>
								<div className="flex shrink-0 items-center gap-2">
								<button aria-label={`${isHidden ? 'Show' : 'Hide'} ${app.title}`} onClick={() => onToggleHide(app.id)} className="rounded-lg border px-2 py-1 text-base font-medium" style={{color: isHidden ? 'rgba(255,255,255,0.6)' : '#7ee7a6', borderColor: focused && action === 'visibility' ? ACCENT : 'transparent'}}>
									{isHidden ? 'Hidden' : 'Shown'}
								</button>
								{canUninstall(app) && <button aria-label={`Uninstall ${app.title}`} onClick={() => onUninstall(app)} className="rounded-lg border px-2 py-1 text-base font-medium text-rose-300" style={{borderColor: focused && action === 'uninstall' ? '#fb7185' : 'transparent'}}>Uninstall</button>}
								</div>
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}

// Location pane: focus the input → the TV's on-screen keyboard opens; typing
// searches Open-Meteo's geocoder (debounced). ↓/OK drops focus into the results
// list; OK there saves the city. Back steps out (results → input → settings).
function LocationPane ({inputRef, query, setQuery, results, searching, mode, resultRow, currentName}: {
	inputRef: RefObject<HTMLInputElement>;
	query: string;
	setQuery: (v: string) => void;
	results: GeoResult[];
	searching: boolean;
	mode: 'type' | 'pick';
	resultRow: number;
	currentName: string;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="px-1 text-base text-white/45">Current: <span className="text-white/80">{currentName}</span></div>
			<input
				ref={inputRef}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search for a city…"
				spellCheck={false}
				autoComplete="off"
				className="w-full rounded-2xl px-6 py-4 text-xl text-white/95 outline-none"
				style={{
					background: 'rgba(255,255,255,0.06)',
					border: `1px solid ${mode === 'type' ? `${ACCENT}aa` : 'rgba(255,255,255,0.14)'}`
				}}
			/>
			<div className="flex max-h-[38vh] min-h-[6rem] flex-col gap-1 overflow-y-auto pr-1">
				{searching && <div className="px-6 py-3 text-lg text-white/45">Searching…</div>}
				{!searching && !!query.trim() && results.length === 0 && (
					<div className="px-6 py-3 text-lg text-white/45">No matches</div>
				)}
				{results.map((g, i) => {
					const focused = mode === 'pick' && i === resultRow;
					return (
						<div
							key={`${g.label}-${g.latitude}-${g.longitude}`}
							className="flex items-center rounded-2xl px-6 py-3"
							style={{
								background: focused ? `${ACCENT}1f` : 'transparent',
								border: `1px solid ${focused ? `${ACCENT}66` : 'transparent'}`
							}}
						>
							<span className="text-lg font-medium text-white/90">{g.label}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default function Settings ({config, onChange, onClose, onOrderReset, lists, hidden, onToggleHide, onRescan, scanning, scanErrors, onUninstall}: {
	config: HomeConfig;
	onChange: (c: HomeConfig) => void;
	onClose: () => void;
	onOrderReset: () => void;
	lists: Record<CatId, AppItem[]>;
	hidden: Set<string>;
	onToggleHide: (id: string) => void;
	onRescan: () => Promise<void>;
	scanning: {apps: boolean; inputs: boolean};
	scanErrors: Partial<Record<'apps' | 'inputs', string>>;
	onUninstall: (app: AppItem) => Promise<void>;
}) {
	const [pane, setPane] = useState<'main' | 'apps' | 'location'>('main');
	const [row, setRow] = useState(0);
	const [resetDone, setResetDone] = useState(false);
	const [appAction, setAppAction] = useState<'visibility' | 'uninstall'>('visibility');
	const [pendingUninstall, setPendingUninstall] = useState<AppItem | null>(null);
	const closeUninstall = useCallback(() => setPendingUninstall(null), []);

	// location-pane state
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<GeoResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [locMode, setLocMode] = useState<'type' | 'pick'>('type');
	const [resultRow, setResultRow] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const mainRowRefs = useRef<(HTMLDivElement | null)[]>([]);

	// internal tiles (this settings screen) can't be hidden — you'd be locked out
	const manageable = useMemo(() => ({
		game: lists.game.filter((a) => a.launchType !== 'internal'),
		stream: lists.stream.filter((a) => a.launchType !== 'internal'),
		media: lists.media.filter((a) => a.launchType !== 'internal'),
		misc: lists.misc.filter((a) => a.launchType !== 'internal')
	}), [lists]);
	const flatApps = useMemo(() => CATS.flatMap((cat) => manageable[cat]), [manageable]);
	const rowCount = pane === 'main' ? ROWS.length : flatApps.length;
	const previousApps = useRef(flatApps);
	useEffect(() => {
		if (pane === 'apps') {
			const id = previousApps.current[row]?.id;
			const next = flatApps.findIndex(app => app.id === id);
			setRow(next >= 0 ? next : Math.max(0, Math.min(row, flatApps.length - 1)));
		}
		previousApps.current = flatApps;
	}, [flatApps, pane]);
	useEffect(() => { if (pane === 'main') mainRowRefs.current[row]?.scrollIntoView({block: 'nearest'}); }, [row, pane]);

	const openLocation = () => { setPane('location'); setLocMode('type'); setQuery(''); setResults([]); setResultRow(0); };
	const closeLocation = () => { setPane('main'); setRow(LOCATION_ROW); setQuery(''); setResults([]); setLocMode('type'); };

	// Debounced geocoder search while typing.
	useEffect(() => {
		if (pane !== 'location') return;
		if (!query.trim()) { setResults([]); setSearching(false); return; }
		setSearching(true);
		let alive = true;
		const id = window.setTimeout(() => {
			searchCity(query).then((res) => { if (alive) { setResults(res); setSearching(false); } });
		}, 350);
		return () => { alive = false; window.clearTimeout(id); };
	}, [query, pane]);

	// Keep the input focused whenever we're in typing mode (opens the TV keyboard).
	useEffect(() => {
		if (pane === 'location' && locMode === 'type') {
			const id = window.setTimeout(() => inputRef.current?.focus(), 0);
			return () => window.clearTimeout(id);
		}
	}, [pane, locMode]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (pendingUninstall) return; // The confirmation dialog owns the keys.
			const typing = pane === 'location' && locMode === 'type';
			// While typing, Backspace edits text — don't treat it as Back.
			const isBack = e.keyCode === 461 || e.key === 'GoBack' || e.key === 'Escape'
				|| (e.key === 'Backspace' && !typing);

			// Typing mode: let characters + the IME through; only steal Back and the
			// "go to results" keys.
			if (typing) {
				if (isBack) { e.preventDefault(); e.stopPropagation(); closeLocation(); return; }
				if ((e.key === 'Enter' || e.key === 'ArrowDown') && results.length) {
					e.preventDefault(); e.stopPropagation();
					inputRef.current?.blur();
					setLocMode('pick'); setResultRow(0);
				}
				return;   // everything else: native input handling
			}

			// All other contexts fully own the keys.
			e.preventDefault();
			e.stopPropagation();

			// Location pane, picking a result
			if (pane === 'location') {
				if (isBack) { setLocMode('type'); return; }   // back to editing
				if (e.key === 'ArrowUp') {
					if (resultRow <= 0) setLocMode('type');
					else setResultRow(resultRow - 1);
					return;
				}
				if (e.key === 'ArrowDown') { setResultRow(Math.min(results.length - 1, resultRow + 1)); return; }
				if (e.key === 'Enter') {
					const g = results[resultRow];
					if (g) { onChange({...config, location: {name: g.name, latitude: g.latitude, longitude: g.longitude}}); closeLocation(); }
					return;
				}
				return;
			}

			if (isBack) {
				if (pane === 'apps') { setPane('main'); setRow(APPS_ROW); }
				else onClose();
				return;
			}
			if (e.key === 'ArrowUp') { setAppAction('visibility'); setRow((r) => Math.max(0, r - 1)); return; }
			if (e.key === 'ArrowDown') { setAppAction('visibility'); setRow((r) => Math.max(0, Math.min(rowCount - 1, r + 1))); return; }
			if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Enter') return;

			if (pane === 'apps') {
				const app = flatApps[row];
				if (!app) return;
				if (e.key === 'ArrowLeft') setAppAction('visibility');
				else if (e.key === 'ArrowRight') setAppAction(canUninstall(app) ? 'uninstall' : 'visibility');
				else if (appAction === 'uninstall') { if (canUninstall(app)) setPendingUninstall(app); }
				else onToggleHide(app.id);
				return;
			}
			const def = ROWS[row];
			if (!def) return;
			if (def.kind === 'info') return;
			if (def.kind === 'location') { if (e.key === 'Enter') openLocation(); return; }
			if (def.kind === 'action') {
				if (e.key !== 'Enter') return;
				if (def.action === 'reset') { resetOrder(); onOrderReset(); setResetDone(true); }
				else if (def.action === 'rescan') { void onRescan(); }
				else { setPane('apps'); setRow(0); }
				return;
			}
			const cur = def.values.indexOf(def.get(config));
			const step = e.key === 'ArrowLeft' ? -1 : 1;
			const next = def.values[(cur + step + def.values.length) % def.values.length];
			onChange(def.set(config, next));
		};
		// capture phase so the app-wide nav handler never sees these keys
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [pane, row, rowCount, config, onChange, onClose, onOrderReset, flatApps, onToggleHide, locMode, results, resultRow, onRescan, appAction, pendingUninstall]);

	const title = pane === 'main' ? 'Settings' : pane === 'apps' ? 'Manage apps' : 'Set location';
	const hint = pane === 'apps'
		? '↑↓ select · ←→ action · OK select · Back to settings'
		: pane === 'location'
			? (locMode === 'type' ? 'Type a city · ↓ to results · Back to settings' : '↑↓ pick · OK select · Back to edit')
			: '↑↓ select · ‹ › change · OK open · Back to close';

	return (
		<div className="absolute inset-0 z-30 flex items-center justify-center" style={{background: 'rgba(0,0,0,0.72)'}}>
			<div role="dialog" aria-label={title} className="m3-card max-h-[90vh] w-[720px] px-10 py-8" style={{animation: 'rise-in 0.35s var(--m3-ease-emphasized) both'}}>
				<h2 className="mb-6 text-[34px] font-normal tracking-tight" style={{color: ACCENT}}>{title}</h2>

				{pane === 'apps' ? (
					<AppsPane lists={manageable} hidden={hidden} row={row} action={appAction} onToggleHide={onToggleHide} onUninstall={setPendingUninstall} />
				) : pane === 'location' ? (
					<LocationPane
						inputRef={inputRef} query={query} setQuery={setQuery} results={results}
						searching={searching} mode={locMode} resultRow={resultRow} currentName={config.location.name}
					/>
				) : (
					<div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto">
						{ROWS.map((def, i) => {
							const focused = i === row;
							return (
								<div
									key={def.label}
									ref={el => { mainRowRefs.current[i] = el; }}
									className="flex items-center justify-between rounded-2xl px-6 py-4"
									style={{
										background: focused ? `${ACCENT}1f` : 'transparent',
										border: `1px solid ${focused ? `${ACCENT}66` : 'transparent'}`,
										transition: 'background var(--m3-dur-short) var(--m3-ease-standard), border-color var(--m3-dur-short) var(--m3-ease-standard)'
									}}
								>
									<span className="text-xl font-medium text-white/92">{def.label}</span>
									{def.kind === 'choice' ? (
										<span className="flex items-center gap-3 text-lg" style={{color: focused ? ACCENT : 'rgba(255,255,255,0.55)'}}>
											{focused && <span className="opacity-70">‹</span>}
											<span className="min-w-[104px] text-center font-medium">{def.labels[def.values.indexOf(def.get(config))]}</span>
											{focused && <span className="opacity-70">›</span>}
										</span>
									) : def.kind === 'location' ? (
										<span className="flex items-center gap-2 text-lg font-medium" style={{color: focused ? ACCENT : 'rgba(255,255,255,0.55)'}}>
											<span className="max-w-[280px] truncate text-right">{config.location.name}</span>
											{focused && <span className="opacity-70">›</span>}
										</span>
									) : def.kind === 'info' ? (
										<span className="text-lg font-medium text-white/40">{def.value}</span>
									) : (
										<span className="text-lg font-medium" style={{color: focused ? ACCENT : 'rgba(255,255,255,0.55)'}}>
											{def.action === 'reset' && resetDone ? 'Done ✓' : def.action === 'rescan' && (scanning.apps || scanning.inputs) ? 'Scanning…' : def.hint}
										</span>
									)}
								</div>
							);
						})}
					</div>
				)}
				{pane === 'main' && (scanErrors.apps || scanErrors.inputs) && (
					<p role="status" className="mt-3 text-base text-amber-200/90">
						{scanErrors.apps && <span className="block">Apps: {scanErrors.apps}</span>}
						{scanErrors.inputs && <span className="block">Inputs: {scanErrors.inputs}</span>}
					</p>
				)}

				<p className="mt-6 text-center text-base text-white/40">{hint}</p>
			</div>
			{pendingUninstall && <UninstallDialog app={pendingUninstall} onUninstall={onUninstall} onClose={closeUninstall} />}
		</div>
	);
}
