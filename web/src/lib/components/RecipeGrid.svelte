<script lang="ts">
	import FavoriteForm from './FavoriteForm.svelte';
	import { isLocal, type RecipeOrigin, type RecipeSummary } from '$lib/recipe';

	interface Props {
		recipes: RecipeSummary[];
		favorites?: string[];
		/**
		 * Which listing this grid is. Travels to the detail page as `?from=`, so its
		 * breadcrumb leads back to the page the user actually came from rather than
		 * always to Discover.
		 */
		origin?: RecipeOrigin;
		/** Rendered into each card's actions slot, after the view link. */
		actions?: import('svelte').Snippet<[RecipeSummary]>;
	}

	let { recipes, favorites = [], origin = 'discover', actions }: Props = $props();

	// One form per card, keyed by recipe id, so the card's event can submit the right one.
	let forms: Record<string, FavoriteForm | undefined> = $state({});

	const onFavoriteToggle = (event: CustomEvent<{ recipeId: string; favorite: boolean }>) => {
		forms[event.detail.recipeId]?.submit();
	};

	/**
	 * Cards fade in one after another rather than all at once. Capped so a long grid does
	 * not leave the last row waiting — past about a dozen the effect has already read.
	 */
	const delay = (index: number) => `${Math.min(index, 11) * 45}ms`;
</script>

<div class="recipe-grid">
	{#each recipes as recipe, index (recipe.id)}
		<!--
			Kebab-case attribute names, which is what Stencil derives from a camelCase prop.
			Svelte sets properties on a custom element only once it has upgraded; during SSR
			it writes attributes, and an attribute named recipeTitle is lowercased by HTML to
			recipetitle, which matches nothing. Writing recipe-title makes the server-rendered
			markup correct on its own.

			`favorite` is omitted when false rather than set to "false": for a boolean prop
			Stencil reads attribute presence, so any non-empty string, "false" included, is true.
		-->
		<rp-recipe-card
			class="grid-item"
			style="--stagger: {delay(index)}"
			recipe-id={recipe.id}
			recipe-title={recipe.title}
			image={recipe.image}
			category={recipe.category}
			href="/recipes/{encodeURIComponent(recipe.id)}?from={origin}"
			href-label="View {recipe.title}"
			favorite={favorites.includes(recipe.id) ? true : undefined}
			onrpFavoriteToggle={onFavoriteToggle}
		>
			{#if isLocal(recipe.id)}
				<span class="card-badge">Yours</span>
			{/if}

			{#if recipe.isVeg}
				<span class="card-badge veg" title="Vegetarian">
					<span class="veg-dot" aria-hidden="true"></span>
					Veg
				</span>
			{/if}

			<!--
				No "View recipe" link: the card carries its own `href` and is clickable in
				full, so a second control to the same place would be redundant. The card's
				link is what the keyboard reaches, and it announces the recipe title.
			-->
			<span slot="actions">
				<FavoriteForm
					bind:this={forms[recipe.id]}
					recipeId={recipe.id}
					favorite={favorites.includes(recipe.id)}
				/>
			</span>

			<!--
				The card's own `gap` separates slotted children from each other, not the
				controls a consumer puts inside one of them, so this wrapper spaces its own.
			-->
			{#if actions}
				<span class="action-group" slot="actions">{@render actions(recipe)}</span>
			{/if}
		</rp-recipe-card>
	{/each}
</div>

<style>
	.action-group {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--rp-space-2);
		align-items: center;
	}

	@media (prefers-reduced-motion: no-preference) {
		/**
		 * `backwards` holds the from-state during the delay. Without it every card paints
		 * at full opacity first and then restarts, which is worse than no animation.
		 */
		.grid-item {
			animation: card-in var(--rp-duration-slow) var(--rp-ease) backwards;
			animation-delay: var(--stagger, 0ms);
		}

		@keyframes card-in {
			from {
				opacity: 0;
				transform: translateY(12px);
			}
		}
	}
</style>
