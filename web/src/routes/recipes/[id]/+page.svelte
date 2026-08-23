<script lang="ts">
	import { page } from '$app/state';
	import { resolveOrigin } from '$lib/recipe';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const recipe = $derived(data.recipe);

	/**
	 * The listing this page was opened from, so the trail leads back there.
	 *
	 * Read from the URL rather than from a store, because the detail page is shareable and
	 * survives a reload; an unrecognised or absent value resolves to Discover.
	 */
	const origin = $derived(resolveOrigin(page.url.searchParams.get('from')));

	/**
	 * TheMealDB stores instructions as one blob with newline breaks.
	 *
	 * Some recipes put their own "STEP 1" heading on a line of its own. Rendering those as
	 * steps produces a card containing nothing but a label, and pushes the real numbering
	 * out of step with the recipe's — so a line that is only a step marker is dropped and
	 * the visible count comes from the instructions that remain.
	 */
	const steps = $derived(
		recipe.instructions
			.split(/\r?\n+/)
			.map((line) => line.trim())
			.filter((line) => line && !/^step\s*\d+\s*[.:)-]?$/i.test(line))
	);

	const description = $derived(
		`${recipe.title} — a ${recipe.area} ${recipe.category.toLowerCase()} recipe with ${recipe.ingredients.length} ingredients.`
	);

	// Re-runs whenever the ingredients change, because the attachment reads $derived state.
	function setIngredients(element: Element) {
		(element as HTMLElement & { items: typeof recipe.ingredients }).items = recipe.ingredients;
	}
</script>

<svelte:head>
	<title>{recipe.title} — Brownie Bites</title>
	<meta name="description" content={description.slice(0, 155)} />
</svelte:head>

<!--
	The trail ends in the recipe itself rather than in its category. A breadcrumb is meant
	to describe the path taken, and naming the current page is what makes the preceding
	link read as "back to where I was".
-->
<nav class="breadcrumb" aria-label="Breadcrumb">
	<a href={origin.href}>{origin.label}</a>
	<span aria-hidden="true">/</span>
	<span class="current" aria-current="page">{recipe.title}</span>
</nav>

<article>
	<header class="hero">
		{#if recipe.image}
			<div class="hero-media">
				<img src={recipe.image} alt="" width="480" height="360" />
			</div>
		{/if}

		<div class="hero-body">
			<span class="eyebrow">{recipe.category}</span>
			<h1>{recipe.title}</h1>

			<div class="stats">
				{#if recipe.area}
					<div class="stat">
						<span class="stat-value">{recipe.area}</span>
						<span class="stat-label">Cuisine</span>
					</div>
				{/if}
				<div class="stat">
					<span class="stat-value">{recipe.ingredients.length}</span>
					<span class="stat-label">Ingredients</span>
				</div>
				<div class="stat">
					<span class="stat-value">{steps.length}</span>
					<span class="stat-label">{steps.length === 1 ? 'Step' : 'Steps'}</span>
				</div>
			</div>
		</div>
	</header>

	<div class="columns">
		<!--
			Assigned as a property rather than an attribute. An array has no attribute form,
			so writing items={…} directly would stringify it to "[object Object],…" in the
			server-rendered HTML. An attachment runs on the real element in the browser,
			which is the only place a property can be set.
		-->
		<aside class="ingredients">
			<rp-ingredient-list {@attach setIngredients}>
				<h2 slot="heading">Ingredients</h2>
				<span>{recipe.ingredients.length} items</span>
			</rp-ingredient-list>
		</aside>

		<section class="instructions">
			<h2>Instructions</h2>
			{#if steps.length === 0}
				<p class="muted">No instructions were provided for this recipe.</p>
			{:else}
				<ol class="steps">
					{#each steps as step, index (index)}
						<li><span class="step-text">{step}</span></li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>
</article>

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
		gap: var(--rp-space-6);
		align-items: center;
		padding: var(--rp-space-5);
		margin-bottom: var(--rp-space-7);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-xl);
		box-shadow: var(--rp-shadow-md);
	}

	.hero-media {
		overflow: hidden;
		border-radius: var(--rp-radius-lg);
		background: var(--rp-color-surface-sunken);
	}

	.hero-media img {
		display: block;
		width: 100%;
		height: 100%;
		max-height: 340px;
		object-fit: cover;
	}

	.hero-body h1 {
		margin: 0;
		font-family: var(--rp-font-serif);
		font-size: clamp(1.75rem, 1.2rem + 2.4vw, 2.75rem);
		font-weight: 600;
		line-height: 1.1;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rp-space-5);
		margin-top: var(--rp-space-5);
		padding-top: var(--rp-space-5);
		border-top: 1px solid var(--rp-color-border);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-value {
		font-family: var(--rp-font-serif);
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--rp-color-text);
	}

	.stat-label {
		font-size: var(--rp-font-size-xs);
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--rp-color-text-subtle);
	}

	/**
	 * The instruction column is capped rather than taking every available pixel.
	 *
	 * With a wide page measure a `2fr` track would set method steps in lines far past
	 * comfortable reading length. The ingredients column keeps its proportional width;
	 * the prose beside it stops growing once it is wide enough.
	 */
	.columns {
		display: grid;
		grid-template-columns: minmax(260px, 1fr) minmax(0, 2fr);
		gap: var(--rp-space-6);
		align-items: start;
	}

	/**
	 * The instruction column is capped on its own rather than in the track.
	 *
	 * `min()` cannot take an `fr` — `minmax(0, min(2fr, 72ch))` is simply invalid and the
	 * declaration is dropped, which left method steps running the full width of a wide
	 * page. Limiting the content inside the track does what the track could not express.
	 */
	.instructions {
		max-width: 72ch;
	}

	/* The list follows the reader down a long instruction column rather than
	   scrolling out of reach at the first step. */
	.ingredients {
		position: sticky;
		top: calc(var(--header-height) + var(--rp-space-5));
	}

	.instructions h2 {
		margin: 0 0 var(--rp-space-5);
		font-family: var(--rp-font-serif);
		font-size: var(--rp-font-size-xl);
		font-weight: 600;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-4);
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}

	.steps li {
		position: relative;
		counter-increment: step;
		padding: var(--rp-space-4) var(--rp-space-4) var(--rp-space-4) var(--rp-space-7);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-lg);
		transition:
			border-color var(--rp-duration) var(--rp-ease),
			box-shadow var(--rp-duration) var(--rp-ease);
	}

	.steps li:hover {
		border-color: var(--rp-color-border-strong);
		box-shadow: var(--rp-shadow-sm);
	}

	.steps li::before {
		content: counter(step);
		position: absolute;
		top: var(--rp-space-4);
		left: var(--rp-space-4);
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		font-family: var(--rp-font-sans);
		font-size: var(--rp-font-size-xs);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--rp-color-accent-contrast);
		background: var(--rp-color-accent);
		border-radius: 50%;
	}

	.step-text {
		display: block;
		color: var(--rp-color-text-body);
	}

	@media (max-width: 900px) {
		.hero {
			grid-template-columns: 1fr;
		}

		.columns {
			grid-template-columns: 1fr;
		}

		.ingredients {
			position: static;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.steps li {
			transition: none;
		}
	}
</style>
