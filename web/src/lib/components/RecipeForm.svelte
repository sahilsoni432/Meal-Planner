<script lang="ts">
	import { enhance } from '$app/forms';
	import VegBanner from './VegBanner.svelte';
	import type { Ingredient } from '$lib/recipe';
	import { validateRecipe, type RecipeErrors, type RecipeInput } from '$lib/validate';

	interface Props {
		values: RecipeInput;
		errors?: RecipeErrors;
		categories: string[];
		submitLabel: string;
		/** Whether the global filter is on, which decides if the warning below can apply. */
		vegOnly?: boolean;
	}

	let { values, errors = {}, categories, submitLabel, vegOnly = false }: Props = $props();

	/**
	 * Tracked locally so the warning appears as the box is unticked rather than after a
	 * submit. The caller keys this component on the recipe being edited, so a different
	 * recipe mounts a fresh form and this reseeds with it.
	 */
	// svelte-ignore state_referenced_locally
	let isVeg = $state(values.isVeg);

	// Only worth warning about when the filter would actually hide the result.
	const willBeHidden = $derived(vegOnly && !isVeg);

	/**
	 * Seeded once from the server, then owned locally so rows can be added and removed.
	 *
	 * The caller keys this component on the recipe it is editing, so a different recipe
	 * mounts a fresh form rather than needing this state to be synced back.
	 */
	// svelte-ignore state_referenced_locally
	let ingredients = $state<Ingredient[]>(
		values.ingredients.length > 0
			? values.ingredients.map((row) => ({ ...row }))
			: [{ name: '', measure: '' }]
	);

	// Client-side validation reuses the server's rules, so the two cannot disagree.
	let clientErrors = $state<RecipeErrors>({});
	let submitted = $state(false);

	// Server errors until the user tries again, then whatever the live check says.
	const shown = $derived(submitted ? clientErrors : errors);

	function addIngredient() {
		ingredients = [...ingredients, { name: '', measure: '' }];
	}

	function removeIngredient(index: number) {
		ingredients = ingredients.filter((_, position) => position !== index);
	}

	function onSubmit(event: SubmitEvent) {
		const form = event.currentTarget as HTMLFormElement;
		const data = new FormData(form);

		const result = validateRecipe({
			title: String(data.get('title') ?? ''),
			category: String(data.get('category') ?? ''),
			area: String(data.get('area') ?? ''),
			instructions: String(data.get('instructions') ?? ''),
			image: String(data.get('image') ?? ''),
			ingredients,
			isVeg
		});

		clientErrors = result.errors;

		// Only show client-side errors once there are some; otherwise a successful submit
		// would flip `shown` to an empty client result and hide nothing useful.
		submitted = !result.valid;

		// Blocking here avoids a pointless round trip; the action re-validates regardless.
		if (!result.valid) event.preventDefault();
	}
</script>

<form method="POST" onsubmit={onSubmit} use:enhance>
	<div class="field">
		<label for="title">Title</label>
		<input
			id="title"
			name="title"
			value={values.title}
			required
			minlength="3"
			maxlength="80"
			aria-invalid={shown.title ? 'true' : undefined}
			aria-describedby={shown.title ? 'title-error' : undefined}
		/>
		{#if shown.title}<p class="error" id="title-error">{shown.title}</p>{/if}
	</div>

	<div class="row">
		<div class="field">
			<label for="category">Category</label>
			<select
				id="category"
				name="category"
				required
				aria-invalid={shown.category ? 'true' : undefined}
			>
				<option value="">Choose…</option>
				{#each categories as category (category)}
					<option value={category} selected={category === values.category}>{category}</option>
				{/each}
			</select>
			{#if shown.category}<p class="error">{shown.category}</p>{/if}
		</div>

		<div class="field">
			<label for="area">Cuisine <span class="optional">optional</span></label>
			<input id="area" name="area" value={values.area} placeholder="e.g. Italian" />
		</div>
	</div>

	<!--
		A plain checkbox, styled as a switch. `bind:checked` keeps the local flag in step
		for the warning below, and because an unchecked box submits no field at all, the
		server reads absence as false — so this works with JavaScript off too.
	-->
	<div class="field">
		<label class="veg-field" for="isVeg">
			<input id="isVeg" name="isVeg" type="checkbox" bind:checked={isVeg} />
			<span class="veg-switch" aria-hidden="true"></span>
			<span class="veg-text">
				<span class="veg-title">Vegetarian recipe</span>
				<span class="veg-hint">Contains no meat, poultry, or seafood.</span>
			</span>
		</label>

		{#if willBeHidden}
			<VegBanner tone="warning">
				<strong>Veg Only mode is currently enabled.</strong> If you save this recipe as
				non-vegetarian, it will not appear in your current My Recipes view until Veg Only mode
				is turned off.
			</VegBanner>
		{/if}
	</div>

	<div class="field">
		<label for="image">Image URL <span class="optional">optional</span></label>
		<input
			id="image"
			name="image"
			type="url"
			value={values.image}
			placeholder="https://…"
			aria-invalid={shown.image ? 'true' : undefined}
		/>
		{#if shown.image}<p class="error">{shown.image}</p>{/if}
	</div>

	<fieldset class="field">
		<legend>Ingredients</legend>
		{#if shown.ingredients}<p class="error">{shown.ingredients}</p>{/if}

		{#each ingredients as ingredient, index (index)}
			<div class="ingredient">
				<input
					name="ingredientName"
					bind:value={ingredient.name}
					placeholder="Ingredient"
					aria-label="Ingredient {index + 1} name"
				/>
				<input
					name="ingredientMeasure"
					bind:value={ingredient.measure}
					placeholder="Measure"
					aria-label="Ingredient {index + 1} measure"
				/>
				<button
					type="button"
					class="remove"
					onclick={() => removeIngredient(index)}
					disabled={ingredients.length === 1}
					aria-label="Remove ingredient {index + 1}"
				>
					&times;
				</button>
			</div>
		{/each}

		<button type="button" class="button secondary add" onclick={addIngredient}>
			Add ingredient
		</button>
	</fieldset>

	<div class="field">
		<label for="instructions">Instructions</label>
		<textarea
			id="instructions"
			name="instructions"
			rows="8"
			required
			minlength="20"
			aria-invalid={shown.instructions ? 'true' : undefined}>{values.instructions}</textarea
		>
		{#if shown.instructions}<p class="error">{shown.instructions}</p>{/if}
	</div>

	<div class="actions">
		<button type="submit" class="button">{submitLabel}</button>
		<a class="button secondary" href="/my-recipes">Cancel</a>
	</div>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-5);
		max-width: 680px;
		padding: var(--rp-space-6);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-xl);
		box-shadow: var(--rp-shadow-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-2);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--rp-space-4);
	}

	@media (max-width: 560px) {
		form {
			padding: var(--rp-space-4);
		}

		.row {
			grid-template-columns: 1fr;
		}
	}

	label,
	legend {
		font-size: var(--rp-font-size-xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--rp-color-text-muted);
	}

	.optional {
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: none;
		color: var(--rp-color-text-subtle);
	}

	/**
	 * The shared `label` rule above sets uppercase small-caps for field captions. This one
	 * is a sentence beside a control rather than a caption over one, so it opts out.
	 */
	.veg-field {
		display: flex;
		gap: var(--rp-space-3);
		align-items: flex-start;
		padding: var(--rp-space-4);
		font-size: var(--rp-font-size-md);
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
		color: var(--rp-color-text-body);
		cursor: pointer;
		background: var(--rp-color-surface-sunken);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-lg);
		transition:
			background-color var(--rp-duration-fast) var(--rp-ease),
			border-color var(--rp-duration-fast) var(--rp-ease);
	}

	.veg-field:hover {
		border-color: var(--rp-color-border-strong);
	}

	.veg-field:has(input:checked) {
		background: var(--veg-soft);
		border-color: var(--veg-border);
	}

	/* Kept in the accessibility tree and focusable; the switch beside it is the visual. */
	.veg-field input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: 0;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.veg-switch {
		position: relative;
		display: block;
		flex-shrink: 0;
		width: 38px;
		height: 22px;
		margin-top: 1px;
		background: var(--switch-track-off, var(--rp-cream-400));
		border-radius: var(--rp-radius-pill);
		transition: background-color var(--rp-duration) var(--rp-ease);
	}

	.veg-switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		background: var(--rp-color-surface);
		border-radius: 50%;
		box-shadow: var(--rp-shadow-xs);
		transition: transform var(--rp-duration) var(--rp-ease);
	}

	.veg-field:has(input:checked) .veg-switch {
		background: var(--veg-strong);
	}

	.veg-field:has(input:checked) .veg-switch::after {
		transform: translateX(16px);
	}

	.veg-field:has(input:focus-visible) .veg-switch {
		outline: var(--rp-focus-ring);
		outline-offset: var(--rp-focus-offset);
	}

	.veg-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.veg-title {
		font-weight: 600;
		color: var(--rp-color-text);
	}

	.veg-hint {
		font-size: var(--rp-font-size-sm);
		color: var(--rp-color-text-muted);
	}

	input,
	select,
	textarea {
		/* Grid and flex items refuse to shrink past their intrinsic minimum, and for a
		   text input that is its default `size`, not zero. */
		min-width: 0;
		padding: 10px var(--rp-space-4);
		font: inherit;
		font-size: var(--rp-font-size-md);
		color: var(--rp-color-text);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border-strong);
		border-radius: var(--rp-radius-md);
		transition:
			border-color var(--rp-duration-fast) var(--rp-ease),
			box-shadow var(--rp-duration-fast) var(--rp-ease);
	}

	input::placeholder,
	textarea::placeholder {
		color: var(--rp-color-text-subtle);
	}

	input:hover,
	select:hover,
	textarea:hover {
		border-color: var(--rp-color-text-subtle);
	}

	/* `:focus` rather than `:focus-visible`: a text field that has been clicked into is
	   focused for typing, and the ring is what shows which field will receive it. */
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--rp-color-focus);
		box-shadow: var(--rp-focus-halo);
	}

	input[aria-invalid='true'],
	select[aria-invalid='true'],
	textarea[aria-invalid='true'] {
		border-color: var(--rp-color-danger);
	}

	input[aria-invalid='true']:focus,
	select[aria-invalid='true']:focus,
	textarea[aria-invalid='true']:focus {
		box-shadow: 0 0 0 4px rgb(180 69 58 / 0.14);
	}

	select {
		cursor: pointer;
	}

	textarea {
		resize: vertical;
		line-height: 1.6;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--rp-space-2);
		margin: 0;
		padding: var(--rp-space-4);
		background: var(--rp-color-surface-sunken);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-lg);
	}

	legend {
		padding: 0 var(--rp-space-2);
	}

	/**
	 * `minmax(0, …)` rather than a bare `2fr 1fr`. A grid track sized in `fr` will not
	 * shrink below its content's intrinsic minimum, and a text input's is its default
	 * `size` attribute — around 175px each. Three of those plus gaps came to 448px inside
	 * a 390px viewport, which is what pushed the row off the screen.
	 */
	.ingredient {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
		gap: var(--rp-space-2);
	}

	/* Below this the two fields are too narrow to read, so measure wraps under name. */
	@media (max-width: 460px) {
		.ingredient {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.ingredient input:first-child {
			grid-column: 1 / -1;
		}
	}

	.remove {
		display: grid;
		place-items: center;
		width: 40px;
		font-size: 1.125rem;
		line-height: 1;
		color: var(--rp-color-text-subtle);
		cursor: pointer;
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border-strong);
		border-radius: var(--rp-radius-md);
		transition:
			color var(--rp-duration-fast) var(--rp-ease),
			background-color var(--rp-duration-fast) var(--rp-ease),
			border-color var(--rp-duration-fast) var(--rp-ease);
	}

	.remove:hover:not(:disabled) {
		color: var(--rp-color-danger);
		background: var(--rp-color-danger-soft);
		border-color: transparent;
	}

	.remove:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.add {
		align-self: flex-start;
		margin-top: var(--rp-space-1);
		padding: 8px var(--rp-space-4);
		font-size: var(--rp-font-size-sm);
	}

	.error {
		display: flex;
		gap: 6px;
		align-items: center;
		margin: 0;
		font-size: var(--rp-font-size-sm);
		font-weight: 500;
		color: var(--rp-color-danger);
	}

	.error::before {
		content: '!';
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 15px;
		height: 15px;
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--rp-color-surface);
		background: var(--rp-color-danger);
		border-radius: 50%;
	}

	.actions {
		display: flex;
		gap: var(--rp-space-3);
		align-items: center;
		padding-top: var(--rp-space-2);
		border-top: 1px solid var(--rp-color-border);
	}

	/* The banner sits inside a gap-spaced column, so its own bottom margin would double up. */
	.field :global(.veg-banner) {
		margin-bottom: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		input,
		select,
		textarea,
		.remove,
		.veg-field,
		.veg-switch,
		.veg-switch::after {
			transition: none;
		}
	}
</style>
