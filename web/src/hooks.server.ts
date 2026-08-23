import { parseTheme, THEME_COOKIE } from '$lib/theme';
import type { Handle, HandleServerError } from '@sveltejs/kit';

/** The canvas colour of each theme, for the browser-chrome `theme-color` meta tag. */
const THEME_COLOR = { light: '#fdfbf7', dark: '#121212' } as const;

/**
 * Runs for every request before it reaches a route.
 *
 * There is no authentication in this application, so nothing is written to `locals`.
 * The timing header is genuinely useful when checking whether a slow page is the
 * upstream API or our own rendering.
 *
 * The theme is resolved here rather than in a layout because it belongs on the `<html>`
 * element, which is outside the component tree entirely. `transformPageChunk` is the only
 * hook that can reach it, and doing it server-side is what puts the right palette in the
 * first byte of HTML instead of repainting after hydration.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const started = performance.now();
	const theme = parseTheme(event.cookies.get(THEME_COOKIE));

	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(/%theme%/g, theme).replace('%themeColor%', THEME_COLOR[theme])
	});

	response.headers.set('x-response-time', `${Math.round(performance.now() - started)}ms`);
	return response;
};

/**
 * Catches unexpected failures only. Expected ones are raised with `error()` and render
 * the nearest `+error.svelte` without ever arriving here.
 */
export const handleError: HandleServerError = ({ error, event }) => {
	console.error(`[${event.route.id ?? event.url.pathname}]`, error);

	// The thrown value may carry internal detail, so the client gets a fixed message.
	return { message: 'Something went wrong loading this page.' };
};
