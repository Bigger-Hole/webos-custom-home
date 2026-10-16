import {useCallback, useEffect, useState} from 'react';
import type {AppItem} from '../lib/apps';

export default function UninstallDialog ({app, onUninstall, onClose}: {
	app: AppItem; onUninstall: (app: AppItem) => Promise<void>; onClose: () => void;
}) {
	const [removeSelected, setRemoveSelected] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const remove = useCallback(async () => {
		if (busy) return;
		setBusy(true); setError('');
		try { await onUninstall(app); setBusy(false); onClose(); }
		catch (e) { setBusy(false); setError(e instanceof Error ? e.message : 'Unable to uninstall this app'); }
	}, [app, busy, onUninstall, onClose]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			e.preventDefault(); e.stopImmediatePropagation();
			if (busy || e.repeat) return;
			if (e.keyCode === 461 || ['Escape', 'Backspace', 'GoBack'].includes(e.key)) { onClose(); return; }
			if (e.key === 'ArrowLeft') setRemoveSelected(false);
			if (e.key === 'ArrowRight') setRemoveSelected(true);
			if (e.key === 'Enter') { if (removeSelected) void remove(); else onClose(); }
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, [busy, removeSelected, remove, onClose]);
	return (
		<div role="alertdialog" aria-label={`Uninstall ${app.title}?`} aria-modal="true" className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
			<div className="m3-card w-[640px] p-10">
				<h2 className="text-3xl text-white">Uninstall {app.title}?</h2>
				<p className="mt-4 text-xl text-white/70">This removes the app from your TV. You will need to reinstall it and may need to sign in again.</p>
				{error && <p role="status" className="mt-4 text-lg text-amber-200">{error}</p>}
				{busy ? <p role="status" className="mt-6 text-xl text-white/80">Uninstalling…</p> : (
					<div className="mt-8 flex justify-end gap-4">
						<button autoFocus onClick={onClose} className="rounded-2xl border px-6 py-3 text-xl" style={{borderColor: !removeSelected ? '#7ca8ff' : 'transparent', color: '#eef1ff'}}>Cancel</button>
						<button onClick={() => void remove()} className="rounded-2xl border px-6 py-3 text-xl" style={{borderColor: removeSelected ? '#fb7185' : 'transparent', color: '#fda4af'}}>Uninstall</button>
					</div>
				)}
				<p className="mt-5 text-base text-white/40">← → choose · OK select · Back cancel</p>
			</div>
		</div>
	);
}
