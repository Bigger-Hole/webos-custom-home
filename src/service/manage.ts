import type {AppItem} from '../lib/apps.ts';
import {lunaCall} from './luna.ts';

export function canUninstall (app: AppItem): boolean {
	return app.removable === true && app.launchType !== 'input' && app.launchType !== 'internal'
		&& app.id !== 'tld.my.customhome' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(app.id);
}

/** Called only after the user confirms removal in Manage apps. */
export async function uninstallApp (app: AppItem): Promise<void> {
	if (!canUninstall(app)) throw new Error('This app cannot be uninstalled here');
	const result = await lunaCall<{statusText?: string; finished?: boolean}>(
		'org.webosbrew.hbchannel.service', 'uninstall', {id: app.id}, 60_000
	);
	if (result.statusText !== 'Finished.' && result.finished !== true) {
		throw new Error('Removal was not confirmed. Rescan before trying again.');
	}
}
