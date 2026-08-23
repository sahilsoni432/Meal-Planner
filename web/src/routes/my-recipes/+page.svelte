<script lang="ts">
	import { enhance } from '$app/forms';
	import RecipeGrid from '$lib/components/RecipeGrid.svelte';
	import VegBanner from '$lib/components/VegBanner.svelte';
	import { useToasts } from '$lib/state/toasts.svelte';
	import type { RecipeSummary } from '$lib/recipe';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const toasts = useToasts();

	// Holds the recipe awaiting delete confirmation; null means the dialog is closed.
	let pendingDelete = $state<RecipeSummary | null>(null);
	let confirmForm = $state<HTMLFormElement>();
</script>

<svelte:head>
	<title>My recipes — Brownie Bites</title>
	<meta name="description" content="Recipes you have created, ready to edit or delete." />
</svelte:head>

<div class="page-head head-row">
	<div>
		<span class="eyebrow">Your kitchen</span>
		<h1>My recipes</h1>
		<p class="lede">Recipes you have written yourself, sitting alongside everything else.</p>
	</div>

	<a class="button" href="/my-recipes/new">
		<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
			<path d="M12 5v14M5 12h14" />
		</svg>
		Add a recipe
	</a>
</div>

{#if data.vegOnly && data.hiddenCount > 0}
	<VegBanner>
		Veg Only mode is active. {data.hiddenCount === 1
			? 'One of your recipes is'
			: `${data.hiddenCount} of your recipes are`} hidden because
		{data.hiddenCount === 1 ? 'it is' : 'they are'} not vegetarian.
	</VegBanner>
{/if}

{#if data.recipes.length === 0}
	<div class="empty-state">
		<span class="empty-state-icon">
			<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
				<path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14M4 19a2 2 0 0 0 2 2h14M4 19h16" />
				<path d="M9 8h6M9 12h6" />
			</svg>
		</span>
		{#if data.vegOnly && data.hiddenCount > 0}
			<h2>No vegetarian recipes</h2>
			<p>Every recipe you have written is non-vegetarian. Turn off Veg Only mode to see them.</p>
		{:else}
			<h2>Nothing here yet</h2>
			<p>Add a family recipe or one you have been meaning to write down. It takes a minute.</p>
		{/if}
		<a class="button" href="/my-recipes/new">Add your first recipe</a>
	</div>
{:else}
	<p class="count-note">{data.recipes.length} {data.recipes.length === 1 ? 'recipe' : 'recipes'}</p>

	<RecipeGrid recipes={data.recipes} favorites={data.favorites} origin="my-recipes">
		{#snippet actions(recipe)}
			<a class="edit-link" href="/my-recipes/{encodeURIComponent(recipe.id)}/edit">
				<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
					<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4z" />
				</svg>
				Edit
			</a>
			<button type="button" class="link-button" onclick={() => (pendingDelete = recipe)}>
				<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
					<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
				</svg>
				Delete
			</button>
		{/snippet}
	</RecipeGrid>
{/if}

<rp-modal
	open={pendingDelete !== null}
	heading="Delete this recipe?"
	onrpClose={() => (pendingDelete = null)}
>
	<p>
		<strong>{pendingDelete?.title}</strong> will be removed permanently, along with its place in your
		favorites and meal plan.
	</p>

	<button
		type="button"
		class="button secondary"
		slot="footer"
		onclick={() => (pendingDelete = null)}
	>
		Cancel
	</button>

	<form
		bind:this={confirmForm}
		slot="footer"
		method="POST"
		action="?/delete"
		use:enhance={() => {
			const title = pendingDelete?.title ?? 'Recipe';
			return async ({ update }) => {
				pendingDelete = null;
				await update();
				toasts.push(`${title} deleted`);
			};
		}}
	>
		<input type="hidden" name="id" value={pendingDelete?.id ?? ''} />
		<button type="submit" class="button danger">Delete</button>
	</form>
</rp-modal>

<style>
	.head-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rp-space-4);
		align-items: flex-end;
		justify-content: space-between;
	}

	/**
	 * Edit and Delete were bare text links three pixels apart, which read as incidental
	 * and made Delete easy to hit by accident. They are proper buttons now, with a real
	 * gap and enough padding to be a comfortable target.
	 */
	.edit-link,
	.link-button {
		display: inline-flex;
		gap: 5px;
		align-items: center;
		padding: 6px var(--rp-space-3);
		font-family: var(--rp-font-sans);
		font-size: var(--rp-font-size-sm);
		font-weight: 600;
		line-height: 1;
		text-decoration: none;
		cursor: pointer;
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border-strong);
		border-radius: var(--rp-radius-md);
		transition:
			color var(--rp-duration-fast) var(--rp-ease),
			background-color var(--rp-duration-fast) var(--rp-ease),
			border-color var(--rp-duration-fast) var(--rp-ease);
	}

	.edit-link svg,
	.link-button svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.edit-link {
		color: var(--rp-color-text-body);
	}

	.edit-link:hover {
		color: var(--rp-color-text);
		background: var(--rp-color-surface-sunken);
		border-color: var(--rp-color-text-subtle);
	}

	.link-button {
		color: var(--rp-color-text-muted);
	}

	/* Destructive styling on hover only, so the resting card is not shouting a warning. */
	.link-button:hover {
		color: var(--rp-color-danger);
		background: var(--rp-color-danger-soft);
		border-color: transparent;
	}
</style>
