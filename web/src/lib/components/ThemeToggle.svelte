<script lang="ts">
	import { writeThemeCookie, type Theme } from '$lib/theme';

	interface Props {
		theme: Theme;
	}

	let { theme }: Props = $props();

	/**
	 * Held locally so the palette flips on the click rather than after a server round trip.
	 * Seeded once; the `$effect` below keeps it in step with the server afterwards.
	 */
	// svelte-ignore state_referenced_locally
	let current = $state<Theme>(theme);

	$effect(() => {
		current = theme;
	});

	/**
	 * Applied straight to the document rather than through a load invalidation.
	 *
	 * The Veg Only toggle has to invalidate, because it changes *which recipes* the server
	 * sends. This changes nothing about the data — only the value of one attribute on the
	 * `<html>` element, which is where every token in both stylesheets is anchored. Setting
	 * it directly repaints the whole application in one frame, with no request at all; the
	 * cookie is written alongside so the server renders the same theme on the next visit.
	 */
	function toggle() {
		const next: Theme = current === 'dark' ? 'light' : 'dark';
		current = next;

		document.documentElement.dataset.theme = next;
		// Keeps form controls, scrollbars, and other browser-drawn UI in the same theme.
		document.documentElement.style.colorScheme = next;
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', next === 'dark' ? '#121212' : '#fdfbf7');

		writeThemeCookie(next);
	}

	const isDark = $derived(current === 'dark');
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={toggle}
	aria-pressed={isDark}
	aria-label="Dark mode"
	title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<!--
		Both glyphs are rendered and crossfaded rather than swapped, so the control keeps a
		fixed size and the change reads as one icon turning into the other.
	-->
	<span class="glyphs" aria-hidden="true">
		<svg class="sun" viewBox="0 0 24 24" width="17" height="17">
			<circle cx="12" cy="12" r="4.2" />
			<path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4" />
		</svg>
		<svg class="moon" viewBox="0 0 24 24" width="17" height="17">
			<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
		</svg>
	</span>
	<span class="visually-hidden">{isDark ? 'Dark mode on' : 'Dark mode off'}</span>
</button>

<style>
	.theme-toggle {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		color: var(--rp-color-text-muted);
		cursor: pointer;
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: 50%;
		transition:
			color var(--rp-duration-fast) var(--rp-ease),
			background-color var(--rp-duration-fast) var(--rp-ease),
			border-color var(--rp-duration-fast) var(--rp-ease);
	}

	.theme-toggle:hover {
		color: var(--rp-color-text);
		border-color: var(--rp-color-border-strong);
	}

	.theme-toggle:focus-visible {
		outline: var(--rp-focus-ring);
		outline-offset: var(--rp-focus-offset);
	}

	/* One grid cell holding both icons, so neither reserves extra width. */
	.glyphs {
		display: grid;
		place-items: center;
	}

	.glyphs svg {
		grid-area: 1 / 1;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition:
			opacity var(--rp-duration) var(--rp-ease),
			transform var(--rp-duration) var(--rp-ease);
	}

	.moon {
		opacity: 0;
		transform: rotate(-70deg) scale(0.6);
	}

	.theme-toggle[aria-pressed='true'] .sun {
		opacity: 0;
		transform: rotate(70deg) scale(0.6);
	}

	.theme-toggle[aria-pressed='true'] .moon {
		opacity: 1;
		transform: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.theme-toggle,
		.glyphs svg {
			transition: none;
		}
	}
</style>
