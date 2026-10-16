import type {ScreenId} from './screens';

export type AppCategory = Exclude<ScreenId, 'home'>;

export interface AppItem {
	id: string;         // webOS appId — used for the real luna launch
	title: string;
	color: string;      // brand accent — tints the tile + dynamic background
	/** Bundled fallback or a raster data URI supplied by the discovery service. */
	icon?: string;
	/** 'internal' opens one of OUR screens (no luna launch) — e.g. the settings overlay */
	launchType?: 'app' | 'input' | 'internal';
	category?: AppCategory;
	removable?: boolean;
	input?: {port: number; connected?: boolean; signal?: boolean; stale?: boolean; labelReported?: boolean; portCount?: number};
}

// Classification/artwork hints only: these never create tiles for absent apps.
// The legacy `game` key is retained to preserve existing saved input orders.
export const APPS: Record<Exclude<ScreenId, 'home'>, AppItem[]> = {
	game: [],
	// Down — streaming services, if installed.
	stream: [
		{id: 'io.strem.tv', title: 'Stremio', color: '#8e5eff', icon: 'icons/stremio.png'},
		{id: 'netflix', title: 'Netflix', color: '#e50914', icon: 'icons/netflix.png'},
		{id: 'com.disney.disneyplus-prod', title: 'Disney+', color: '#1f6feb', icon: 'icons/disney.png'},
		{id: 'amazon', title: 'Prime Video', color: '#00a8e1', icon: 'icons/prime.png'},
		{id: 'com.wbd.stream', title: 'HBO Max', color: '#7b2ff7', icon: 'icons/hbomax.png'},
		{id: 'hulu', title: 'Hulu', color: '#1ce783', icon: 'icons/hulu.png'},
		{id: 'com.apple.appletv', title: 'Apple TV', color: '#b8bcc4', icon: 'icons/appletv.png'},
		{id: 'youtube.leanback.ytv.v1', title: 'YouTube TV', color: '#ff4e45', icon: 'icons/youtubetv.png'},
		{id: 'com.plutotv.app', title: 'Pluto TV', color: '#ffdd00', icon: 'icons/pluto.png'},
		{id: 'com.tubitv.ott.tubi', title: 'Tubi', color: '#8b5cf6', icon: 'icons/tubi.png'},
		{id: 'com.espn.espnplus-prod', title: 'ESPN', color: '#d50a0a', icon: 'icons/espn.png'},
		{id: 'imdbtv', title: 'Freevee', color: '#f5c518', icon: 'icons/freevee.png'},
		{id: 'vudu', title: 'Fandango', color: '#3399ff', icon: 'icons/fandango.png'}
	],
	// Left — music / video / casting.
	media: [
		{id: 'youtube.leanback.v4', title: 'YouTube', color: '#ff0033', icon: 'icons/youtube.png'},
		{id: 'spotify-beehive', title: 'Spotify', color: '#1db954', icon: 'icons/spotify.png'},
		{id: 'twitch.adamffdev.v1', title: 'Twitch', color: '#9146ff', icon: 'icons/twitch.jpg'},
		{id: 'com.instantbits.cast.webvideo', title: 'Web Video Caster', color: '#ff9500', icon: 'icons/webvideo.png'}
	],
	// Right — tools, games & everything else.
	misc: [
		{id: 'org.webosbrew.hbchannel', title: 'Homebrew', color: '#34d399', icon: 'icons/homebrew.png'},
		{id: 'com.twin.app.gamingportal', title: 'Gaming Portal', color: '#a855f7', icon: 'icons/gamingportal.png'},
		{id: 'com.ubisoft.lg.justdancenow', title: 'Just Dance', color: '#ff2e93', icon: 'icons/justdance.png'},
		{id: 'com.twin.app.homegym', title: 'LG Fitness', color: '#22c55e', icon: 'icons/fitness.png'},
		{id: 'com.lgshop.app', title: 'ShopTime', color: '#f59e0b', icon: 'icons/shoptime.png'},
		// In-app settings overlay (com.webos.app.settings probed "not exist" on this TV,
		// and the user wants real in-app settings anyway).
		{id: 'internal.settings', title: 'Settings', color: '#94a3b8', icon: 'icons/settings.png', launchType: 'internal'}
	]
};
