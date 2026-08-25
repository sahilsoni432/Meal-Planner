/**
 * The Veg Only preference.
 *
 * Its own cookie rather than the store: the store cookie is `httpOnly` and near its 4KB
 * cap already, and a script-readable flag lets the toggle re-run the loads without a form
 * POST while the server still sees it on the first request.
 *
 * Imported by both server and client code, so it holds no browser globals at the top level.
 */

export const VEG_COOKIE = 'vegOnly';

/**
 * The dependency key every load that reads the preference registers with `depends()`.
 *
 * A server load's use of `cookies.get()` is invisible to SvelteKit's dependency tracking,
 * so `invalidateAll()` would not re-run it without this.
 */
export const VEG_DEPENDENCY = 'app:vegOnly';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseVegOnly(value: string | undefined): boolean {
	return value === '1';
}

/** Not `httpOnly` — the toggle sets this from the browser. */
export function writeVegOnlyCookie(vegOnly: boolean): void {
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${VEG_COOKIE}=${vegOnly ? '1' : '0'}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
