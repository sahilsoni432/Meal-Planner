<script lang="ts">
	import { page } from '$app/state';

	interface NavItem {
		href: string;
		label: string;
		count: number | null;
	}

	interface Props {
		items: NavItem[];
		isCurrent: (href: string) => boolean;
	}

	let { items, isCurrent }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();

	/**
	 * Closes on navigation.
	 *
	 * SvelteKit reuses the layout across routes, so this component is never destroyed and
	 * would otherwise stay open over the page the user just chose. Reading the pathname is
	 * what subscribes the effect to it.
	 */
	$effect(() => {
		page.url.pathname;
		open = false;
	});

	/**
	 * Dismisses on any press outside the menu.
	 *
	 * `pointerdown` rather than `click`, so the menu is already gone by the time a press on
	 * something behind it activates — on `click` the two would land in the same frame and
	 * the panel would appear to linger through the tap.
	 */
	$effect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!root?.contains(event.target as Node)) open = false;
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') open = false;
		};

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});

	const currentLabel = $derived(items.find((item) => isCurrent(item.href))?.label ?? 'Menu');
</script>

<div class="nav-menu" bind:this={root}>
	<button
		type="button"
		class="trigger"
		aria-expanded={open}
		aria-haspopup="true"
		aria-controls="nav-menu-list"
		aria-label="{open ? 'Close' : 'Open'} navigation menu — currently on {currentLabel}"
		onclick={() => (open = !open)}
	>
		<span class="bars" class:is-open={open} aria-hidden="true">
			<span></span>
			<span></span>
			<span></span>
		</span>
	</button>

	{#if open}
		<!--
			Rendered only while open rather than hidden with CSS, so its links are out of the
			tab order entirely when the menu is closed. A visually hidden but focusable link
			is a keyboard trap in miniature.
		-->
		<nav class="panel" id="nav-menu-list" aria-label="Main">
			{#each items as item (item.href)}
				<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
					<span class="label">{item.label}</span>
					{#if item.count !== null && item.count > 0}
						<span class="nav-count">{item.count}</span>
					{/if}
				</a>
			{/each}
		</nav>
	{/if}
</div>

<style>
	.nav-menu {
		position: relative;
		flex-shrink: 0;
	}

	.trigger {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		color: var(--rp-color-text);
		cursor: pointer;
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-md);
		transition:
			background-color var(--rp-duration-fast) var(--rp-ease),
			border-color var(--rp-duration-fast) var(--rp-ease);
	}

	.trigger:hover,
	.trigger[aria-expanded='true'] {
		background: var(--rp-color-surface-sunken);
		border-color: var(--rp-color-border-strong);
	}

	.trigger:focus-visible {
		outline: var(--rp-focus-ring);
		outline-offset: var(--rp-focus-offset);
	}

	.bars {
		display: grid;
		gap: 4px;
		width: 17px;
	}

	.bars span {
		display: block;
		height: 1.8px;
		background: currentColor;
		border-radius: 2px;
		transition: transform var(--rp-duration) var(--rp-ease), opacity var(--rp-duration) var(--rp-ease);
	}

	/* The three bars fold into a cross, so the control says what pressing it will do. */
	.bars.is-open span:nth-child(1) {
		transform: translateY(5.8px) rotate(45deg);
	}

	.bars.is-open span:nth-child(2) {
		opacity: 0;
	}

	.bars.is-open span:nth-child(3) {
		transform: translateY(-5.8px) rotate(-45deg);
	}

	.panel {
		position: absolute;
		inset-block-start: calc(100% + var(--rp-space-2));
		inset-inline-end: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 208px;
		padding: var(--rp-space-2);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-lg);
		box-shadow: var(--rp-shadow-lg);
	}

	.panel a {
		display: flex;
		gap: var(--rp-space-3);
		align-items: center;
		justify-content: space-between;
		padding: 10px var(--rp-space-3);
		font-size: var(--rp-font-size-md);
		font-weight: 500;
		color: var(--rp-color-text-body);
		text-decoration: none;
		border-radius: var(--rp-radius-md);
		transition:
			color var(--rp-duration-fast) var(--rp-ease),
			background-color var(--rp-duration-fast) var(--rp-ease);
	}

	.panel a:hover {
		color: var(--rp-color-text);
		background: var(--rp-color-surface-sunken);
	}

	.panel a[aria-current='page'] {
		color: var(--rp-color-accent-contrast);
		background: var(--rp-color-accent);
	}

	.nav-count {
		display: grid;
		place-items: center;
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		font-size: 0.6875rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--rp-caramel-600);
		background: var(--rp-color-highlight-soft);
		border-radius: var(--rp-radius-pill);
	}

	.panel a[aria-current='page'] .nav-count {
		color: var(--rp-color-accent);
		background: var(--rp-color-surface);
	}

	@media (prefers-reduced-motion: no-preference) {
		.panel {
			animation: menu-in var(--rp-duration) var(--rp-ease);
		}

		@keyframes menu-in {
			from {
				opacity: 0;
				transform: translateY(-6px);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.trigger,
		.bars span,
		.panel a {
			transition: none;
		}
	}
</style>
