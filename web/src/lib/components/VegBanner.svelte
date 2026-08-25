<script lang="ts">
	interface Props {
		/** `info` states a filter is active; `warning` says the user is about to lose sight of something. */
		tone?: 'info' | 'warning';
		children: import('svelte').Snippet;
	}

	let { tone = 'info', children }: Props = $props();
</script>

<p class="veg-banner" class:warning={tone === 'warning'} role="status">
	<span class="icon" aria-hidden="true">
		{#if tone === 'warning'}
			<svg viewBox="0 0 24 24" width="15" height="15">
				<path d="M12 3.5 2.5 20h19L12 3.5Z" />
				<path d="M12 10v4M12 17v.01" />
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" width="15" height="15">
				<circle cx="12" cy="12" r="9" />
				<path d="M12 11v5M12 8v.01" />
			</svg>
		{/if}
	</span>
	<span>{@render children()}</span>
</p>

<style>
	.veg-banner {
		display: flex;
		gap: var(--rp-space-3);
		align-items: flex-start;
		/* One line of explanation, not a band of text the full width of a wide display. */
		max-width: var(--measure-prose, 68ch);
		margin: 0 0 var(--rp-space-5);
		padding: var(--rp-space-3) var(--rp-space-4);
		font-size: var(--rp-font-size-md);
		line-height: 1.5;
		color: var(--veg-ink);
		background: var(--veg-soft);
		border: 1px solid var(--veg-border);
		border-radius: var(--rp-radius-lg);
	}

	.veg-banner.warning {
		color: var(--warn-ink);
		background: var(--warn-soft);
		border-color: var(--warn-border);
	}

	.icon {
		display: block;
		flex-shrink: 0;
		/* Optically centres the glyph on the first line of text rather than its box. */
		margin-top: 2px;
	}

	.icon svg {
		display: block;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.9;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
