<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import RecipeGrid from '$lib/components/RecipeGrid.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const heading = $derived(
		data.mode === 'search'
			? `Results for “${data.query}”`
			: data.mode === 'filter'
				? `${data.category || data.area}`
				: 'Cook something worth sitting down for'
	);

	const lede = $derived(
		data.mode === 'search'
			? `Recipes matching your search.`
			: data.mode === 'filter'
				? `Every recipe we have in this collection.`
				: 'Search thousands of recipes, save the ones you love, and build a week of meals you will actually make.'
	);

	/**
	 * Search and filter state lives in the URL rather than in component state, so a
	 * filtered view is shareable, survives reload, and re-runs the server load on change.
	 */
	function applyParams(changes: Record<string, string | null>) {
		const params = new URLSearchParams(page.url.searchParams);

		for (const [key, value] of Object.entries(changes)) {
			if (value) params.set(key, value);
			else params.delete(key);
		}

		const query = params.toString();
		goto(query ? `/?${query}` : '/', { keepFocus: true, noScroll: true });
	}

	const onSearch = (event: CustomEvent<string>) =>
		applyParams({ q: event.detail, category: null, area: null });

	const onClear = () => applyParams({ q: null });

	const onCategoryChange = (event: CustomEvent<string | null>) =>
		applyParams({ category: event.detail, area: null, q: null });

	const onAreaChange = (event: CustomEvent<string | null>) =>
		applyParams({ area: event.detail, category: null, q: null });

	const clearFilters = () => applyParams({ category: null, area: null, q: null });

	const activeFilterCount = $derived(
		[data.category, data.area, data.query].filter(Boolean).length
	);

	/**
	 * Closes the other menu when one opens.
	 *
	 * Each menu closes itself on an outside click, but a click on the *other* trigger
	 * opens the second before the first has processed its own dismissal, so both would
	 * otherwise be open with overlapping trays.
	 *
	 * The opened menu is identified by `detail.label` rather than by `currentTarget`: the
	 * event is emitted from a `@Watch`, so by the time this handler runs the dispatch has
	 * finished and `currentTarget` is null.
	 */
	function onMenuToggle(event: CustomEvent<{ label: string; open: boolean }>) {
		if (!event.detail.open) return;

		for (const menu of document.querySelectorAll('rp-filter-menu')) {
			const element = menu as HTMLElement & { label: string; open: boolean };
			if (element.label !== event.detail.label) element.open = false;
		}
	}

	/** Sets an array prop as a DOM property, which is the only form an array can take. */
	const setOptions = (options: string[]) => (element: Element) => {
		(element as HTMLElement & { options: string[] }).options = options;
	};
</script>

<svelte:head>
	<title>{data.mode === 'browse' ? 'Discover recipes' : heading} — Brownie Bites</title>
	<meta
		name="description"
		content="Search thousands of recipes, filter by category or cuisine, and build a weekly meal plan."
	/>
</svelte:head>

<div class="page-head">
	{#if data.mode === 'browse'}
		<span class="eyebrow">Brownie Bites</span>
	{/if}
	<h1>{heading}</h1>
	<p class="lede">{lede}</p>
</div>

<div class="controls">
	<rp-search-bar
		value={data.query}
		placeholder={'Search "Breakfast"'}
		onrpSearch={onSearch}
		onrpClear={onClear}
	></rp-search-bar>

	<!--
		`options` is assigned as a property through an attachment. Rendered as an attribute
		it would be comma-joined, which is lossy: a cuisine such as "Antiguan, Barbudan"
		contains a comma and would split into two wrong entries.

		The full cuisine list is passed rather than the first twelve: the menu has a search
		field, so there is no longer a reason to withhold the rest.
	-->
	<div class="filters">
		<rp-filter-menu
			label="Category"
			search-placeholder="Search categories"
			selected={data.category || null}
			onrpFilterChange={onCategoryChange}
			onrpMenuToggle={onMenuToggle}
			{@attach setOptions(data.categories)}
		></rp-filter-menu>

		<rp-filter-menu
			label="Cuisine"
			search-placeholder="Search cuisines"
			selected={data.area || null}
			onrpFilterChange={onAreaChange}
			onrpMenuToggle={onMenuToggle}
			{@attach setOptions(data.areas)}
		></rp-filter-menu>

		{#if activeFilterCount > 0}
			<button type="button" class="clear-all" onclick={clearFilters}>
				Clear all
				<span class="clear-count">{activeFilterCount}</span>
			</button>
		{/if}
	</div>
</div>

{#if data.mode === 'browse'}
	{#each data.rows as row (row.category)}
		<section class="section-block">
			<div class="section-title">
				<h2>{row.category}</h2>
				<a class="card-link" href="/?category={encodeURIComponent(row.category)}">
					See all {row.category}
				</a>
			</div>
			<RecipeGrid recipes={row.recipes} favorites={data.favorites} />
		</section>
	{/each}
{:else if data.results.length === 0}
	<div class="empty-state">
		<span class="empty-state-icon">
			<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-3.6-3.6" />
			</svg>
		</span>
		<h2>Nothing matched</h2>
		<p>
			We found no recipes{data.query ? ` for “${data.query}”` : ''}.
			{#if data.vegOnly}
				Veg Only mode is on, so meat and seafood results are hidden — turning it off may
				show more.
			{:else}
				Try a different search, or clear the filters to browse everything.
			{/if}
		</p>
		<a class="button secondary" href="/">Clear filters</a>
	</div>
{:else}
	<p class="count-note">{data.results.length} {data.results.length === 1 ? 'recipe' : 'recipes'}</p>
	<RecipeGrid recipes={data.results} favorites={data.favorites} />
{/if}

<style>
	/**
	 * `backdrop-filter` makes this a stacking context, which traps the filter tray's own
	 * z-index inside it — the tray would render behind the recipe grid, whose cards each
	 * establish a context of their own through `transform` on hover. Giving the panel a
	 * position and a z-index of its own lifts the whole thing, tray included, above the
	 * grid rather than trying to raise the tray past a ceiling it cannot cross.
	 */
	.controls {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-5);
		padding: var(--rp-space-5);
		margin-bottom: var(--rp-space-6);
		background: color-mix(in srgb, var(--rp-color-surface) 75%, transparent);
		backdrop-filter: blur(10px);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-xl);
		box-shadow: var(--rp-shadow-md);
	}

	/**
	 * A single row of triggers rather than two stacked chip rows. The trays are absolutely
	 * positioned, so this stays one line tall no matter how many options exist — which was
	 * the point: the previous layout put roughly 25 chips above the first recipe.
	 */
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rp-space-2);
		align-items: center;
	}

	.clear-all {
		display: inline-flex;
		gap: var(--rp-space-2);
		align-items: center;
		padding: 8px var(--rp-space-4);
		font: inherit;
		font-size: var(--rp-font-size-sm);
		font-weight: 600;
		color: var(--rp-color-text-muted);
		cursor: pointer;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--rp-radius-pill);
		transition:
			color var(--rp-duration-fast) var(--rp-ease),
			background-color var(--rp-duration-fast) var(--rp-ease);
	}

	.clear-all:hover {
		color: var(--rp-color-danger);
		background: var(--rp-color-danger-soft);
	}

	.clear-count {
		display: grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		font-size: 0.6875rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--rp-caramel-600);
		background: var(--rp-color-highlight-soft);
		border-radius: var(--rp-radius-pill);
	}

	@media (max-width: 560px) {
		.controls {
			padding: var(--rp-space-4);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.clear-all {
			transition: none;
		}
	}
</style>
