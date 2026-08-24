<script lang="ts">
	import { useToasts } from '$lib/state/toasts.svelte';

	const toasts = useToasts();
</script>

<!-- aria-live announces new messages without moving focus away from the user's task. -->
<div class="toasts" role="status" aria-live="polite">
	{#each toasts.items as toast (toast.id)}
		<div class="toast" class:error={toast.kind === 'error'}>
			<span>{toast.message}</span>
			<button type="button" onclick={() => toasts.dismiss(toast.id)} aria-label="Dismiss">
				<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		right: var(--rp-space-5);
		bottom: var(--rp-space-5);
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-2);
		/* The container spans the viewport edge to edge; only the toasts themselves
		   should intercept clicks. */
		pointer-events: none;
	}

	.toast {
		display: flex;
		gap: var(--rp-space-3);
		align-items: center;
		justify-content: space-between;
		/* A message long enough to wrap must not stretch the pill into a lozenge with the
		   button floating in the middle of it, which is what happens on a narrow screen. */
		max-width: min(420px, 100%);
		padding: var(--rp-space-3) var(--rp-space-3) var(--rp-space-3) var(--rp-space-5);
		font-size: var(--rp-font-size-md);
		font-weight: 500;
		line-height: 1.4;
		/**
		 * A toast is deliberately the inverse of the page it sits on — dark on cream, and
		 * so it must be light on carbon. Using the accent tokens would make it invisible in
		 * the dark theme, where the accent *is* the light colour, so it gets its own pair.
		 */
		color: var(--toast-ink, var(--rp-cream-50));
		background: var(--toast-bg, var(--rp-espresso-800));
		border: 1px solid var(--toast-border, rgb(255 255 255 / 0.08));
		border-radius: var(--rp-radius-pill);
		box-shadow: var(--rp-shadow-xl);
		pointer-events: auto;
	}

	.toast.error {
		background: var(--rp-color-danger);
	}

	button {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		/* Holds the button on the first line of a wrapped message instead of letting it
		   drift to the vertical centre of a two- or three-line block. */
		align-self: flex-start;
		width: 26px;
		height: 26px;
		padding: 0;
		color: inherit;
		cursor: pointer;
		background: var(--toast-button-bg, rgb(255 255 255 / 0.12));
		border: none;
		border-radius: 50%;
		transition: background-color var(--rp-duration-fast) var(--rp-ease);
	}

	button svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.4;
		stroke-linecap: round;
	}

	button:hover {
		background: var(--toast-button-hover, rgb(255 255 255 / 0.24));
	}

	@media (max-width: 560px) {
		.toasts {
			right: var(--rp-space-3);
			left: var(--rp-space-3);
			bottom: var(--rp-space-3);
			/* Toasts are as wide as their text up to the full width, rather than every one
			   stretching edge to edge regardless of how short its message is. */
			align-items: stretch;
		}

		.toast {
			max-width: 100%;
			/**
			 * A rounded rectangle, not a pill.
			 *
			 * The pill radius is half the height, so once a message wraps to two lines the
			 * ends bow outwards and the dismiss button — vertically centred against a now
			 * much taller box — reads as floating in the middle of it. A fixed radius keeps
			 * the shape square-shouldered however many lines the text takes.
			 */
			border-radius: var(--rp-radius-lg);
			padding: var(--rp-space-3) var(--rp-space-3) var(--rp-space-3) var(--rp-space-4);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.toast {
			animation: toast-in var(--rp-duration) var(--rp-ease);
		}

		@keyframes toast-in {
			from {
				opacity: 0;
				transform: translateY(12px) scale(0.96);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none;
		}
	}
</style>
