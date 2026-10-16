import type {AppItem} from '../lib/apps.ts';
import {normalizeApps, normalizeInputs} from '../lib/discovery.ts';
import {lunaCall, listLaunchPoints} from './luna.ts';

export async function scanApps (): Promise<AppItem[]> {
	try {
		return normalizeApps(await lunaCall('tld.my.customhome.service', 'discoverApps', {}, 10_000));
	} catch {
		return normalizeApps(await listLaunchPoints());
	}
}
export async function scanInputs (): Promise<AppItem[]> {
	try {
		return normalizeInputs(await lunaCall('tld.my.customhome.service', 'discoverInputs', {}, 6000));
	} catch {
		return normalizeInputs(await lunaCall('com.webos.service.eim', 'getAllInputStatus'));
	}
}
