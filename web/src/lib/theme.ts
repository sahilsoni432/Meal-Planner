/**
 * The light/dark theme preference.
 *
 * Its own cookie rather than the store: readable from script so the toggle can flip it
 * without a form POST, and visible to the server on the first request. That second point
 * is what avoids the flash of the wrong theme — `data-theme` is already on the `<html>`
 * element in the first byte of HTML, so there is no first paint to correct.
 *
 * Imported by both server and client code, so it holds no browser globals at the top level.
 */

export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'theme';

/**
 * The dependency key every load that reads the preference registers with `depends()`.
 *
 * A server load's use of `cookies.get()` is invisible to SvelteKit's dependency tracking,
 * so `invalidateAll()` would not re-run it without this.
 */
export const THEME_DEPENDENCY = 'app:theme';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Light is the default for an unset cookie.
 *
 * Deliberately not `prefers-color-scheme`: the server cannot read a media query, so
 * honouring it would mean either rendering the wrong theme and correcting it after
 * hydration, or blocking the first paint on a script.
 */
export function parseTheme(value: string | undefined): Theme {
	return value === 'dark' ? 'dark' : 'light';
}

/** Not `httpOnly` — the toggle sets this from the browser. */
export function writeThemeCookie(theme: Theme): void {
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
