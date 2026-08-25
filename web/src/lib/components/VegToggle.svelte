<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { VEG_DEPENDENCY, writeVegOnlyCookie } from '$lib/vegMode';
	import { useToasts } from '$lib/state/toasts.svelte';

	interface Props {
		vegOnly: boolean;
	}

	let { vegOnly }: Props = $props();

	const toasts = useToasts();

	/**
	 * Held locally so the switch moves on the click rather than after the server round
	 * trip, then reconciled from the prop when the loads re-run. Seeded once — the
	 * `$effect` below is what keeps it in step afterwards.
	 */
	// svelte-ignore state_referenced_locally
	let optimistic = $state(vegOnly);
	let pending = $state(false);

	/**
	 * Re-syncs when the server's answer differs from what was assumed, which happens if
	 * the cookie could not be written or another tab changed it. Assigning to state from
	 * an effect is normally the anti-pattern `$derived` replaces, but here the local value
	 * is genuinely owned by this component between click and reload — a `$derived` would
	 * discard the optimistic value the instant it was set.
	 */
	$effect(() => {
		if (!pending) optimistic = vegOnly;
	});

	async function toggle() {
		const next = !optimistic;
		optimistic = next;
		pending = true;

		writeVegOnlyCookie(next);

		/**
		 * Re-runs every load that registered this dependency, which applies the change
		 * across the layout and the current page at once — no store to keep in sync with
		 * the server's view.
		 *
		 * `invalidate(VEG_DEPENDENCY)` rather than `invalidateAll()`: a server load's use
		 * of `cookies.get()` is invisible to SvelteKit's dependency tracking, so
		 * `invalidateAll()` re-runs nothing here and the page keeps its cached data until
		 * a full reload. The loads declare this key with `depends()` to make the link
		 * explicit, and this is the other half of that contract.
		 */
		await invalidate(VEG_DEPENDENCY);

		pending = false;
		toasts.push(next ? 'Veg Only mode on' : 'Veg Only mode off');
	}
</script>

<button
	type="button"
	class="veg-toggle"
	class:is-on={optimistic}
	role="switch"
	aria-checked={optimistic}
	aria-label="Veg Only mode"
	onclick={toggle}
>
	<span class="track" aria-hidden="true">
		<span class="thumb">
			<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
				<circle cx="12" cy="12" r="6" />
			</svg>
		</span>
	</span>
	<span class="label">
		<span class="label-long">Veg Only</span>
		<span class="label-short">Veg</span>
	</span>
</button>

<style>
	.veg-toggle {
		display: inline-flex;
		gap: var(--rp-space-2);
		align-items: center;
		padding: 6px var(--rp-space-3) 6px 6px;
		font: inherit;
		font-size: var(--rp-font-size-sm);
		font-weight: 600;
		color: var(--rp-color-text-muted);
		white-space: nowrap;
		cursor: pointer;
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-pill);
		transition:
			color var(--rp-duration-fast) var(--rp-ease),
			background-color var(--rp-duration-fast) var(--rp-ease),
			border-color var(--rp-duration-fast) var(--rp-ease),
			box-shadow var(--rp-duration-fast) var(--rp-ease);
	}

	.veg-toggle:hover {
		border-color: var(--rp-color-border-strong);
	}

	.veg-toggle.is-on {
		color: var(--veg-ink);
		background: var(--veg-soft);
		border-color: var(--veg-border);
		box-shadow: var(--rp-shadow-xs);
	}

	.track {
		position: relative;
		display: block;
		flex-shrink: 0;
		width: 32px;
		height: 20px;
		background: var(--switch-track-off, var(--rp-cream-400));
		border-radius: var(--rp-radius-pill);
		transition: background-color var(--rp-duration) var(--rp-ease);
	}

	.veg-toggle.is-on .track {
		background: var(--veg-strong);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		background: var(--rp-color-surface);
		border-radius: 50%;
		box-shadow: var(--rp-shadow-xs);
		transition: transform var(--rp-duration) var(--rp-ease);
	}

	.veg-toggle.is-on .thumb {
		transform: translateX(12px);
	}

	.thumb svg {
		fill: var(--rp-color-text-subtle);
		transition: fill var(--rp-duration) var(--rp-ease);
	}

	.veg-toggle.is-on .thumb svg {
		fill: var(--veg-strong);
	}

	.veg-toggle:focus-visible {
		outline: var(--rp-focus-ring);
		outline-offset: var(--rp-focus-offset);
	}

	.label-short {
		display: none;
	}

	/**
	 * The word stays. A green switch on its own does not say "vegetarian" to anyone who
	 * has not already been told, and the accessible name only helps a screen reader — a
	 * sighted user on a phone was left guessing. It shortens to "Veg" instead, which is
	 * unambiguous next to the switch and fits the space that is actually available.
	 */
	@media (max-width: 960px) {
		.veg-toggle {
			gap: 6px;
			padding: 5px var(--rp-space-2) 5px 5px;
			font-size: var(--rp-font-size-xs);
		}

		.label-long {
			display: none;
		}

		.label-short {
			display: inline;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.veg-toggle,
		.track,
		.thumb,
		.thumb svg {
			transition: none;
		}
	}
</style>
