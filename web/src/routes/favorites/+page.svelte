<script lang="ts">
	import RecipeGrid from '$lib/components/RecipeGrid.svelte';
	import VegBanner from '$lib/components/VegBanner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Favorites — Brownie Bites</title>
	<meta name="description" content="Every recipe you have saved to your favorites." />
</svelte:head>

<div class="page-head">
	<span class="eyebrow">Saved</span>
	<h1>Favorites</h1>
	<p class="lede">The recipes you keep coming back to, in one place.</p>
</div>

{#if data.vegOnly && data.hiddenCount > 0}
	<VegBanner>
		Veg Only mode is active. {data.hiddenCount === 1
			? 'One saved recipe is'
			: `${data.hiddenCount} saved recipes are`} hidden because
		{data.hiddenCount === 1 ? 'it is' : 'they are'} not vegetarian.
	</VegBanner>
{/if}

{#if data.recipes.length === 0}
	<div class="empty-state">
		<span class="empty-state-icon">
			<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
				<path
					d="M12 21s-7.5-4.7-9.3-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.3 12c-1.8 4.3-9.3 9-9.3 9z"
				/>
			</svg>
		</span>
		{#if data.vegOnly && data.hiddenCount > 0}
			<h2>No vegetarian favorites</h2>
			<p>Everything you have saved is non-vegetarian. Turn off Veg Only mode to see it.</p>
		{:else}
			<h2>No favorites yet</h2>
			<p>Tap the heart on any recipe and it will be waiting for you here.</p>
		{/if}
		<a class="button" href="/">Browse recipes</a>
	</div>
{:else}
	<p class="count-note">{data.recipes.length} saved</p>
	<RecipeGrid recipes={data.recipes} favorites={data.favorites} origin="favorites" />
{/if}
