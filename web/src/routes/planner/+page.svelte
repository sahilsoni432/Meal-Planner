<script lang="ts">
	import { enhance } from '$app/forms';
	import VegBanner from '$lib/components/VegBanner.svelte';
	import { DAY_LABELS, DAY_LABELS_SHORT, DAYS, type Day } from '$lib/recipe';
	import { useToasts } from '$lib/state/toasts.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const toasts = useToasts();

	// The day the picker is assigning to; null means the dialog is closed.
	let pickingFor = $state<Day | null>(null);
	let modal = $state<HTMLElement & { focusFirstField(): Promise<void> }>();
	let assignForm = $state<HTMLFormElement>();
	let selectedRecipe = $state('');

	const plannedCount = $derived(data.week.reduce((total, day) => total + day.meals.length, 0));

	// `rp-select` takes `{value,label}` pairs; an array has no attribute form, so Svelte
	// assigns it as a DOM property.
	const pickerOptions = $derived(
		data.candidates.map((candidate) => ({ value: candidate.id, label: candidate.title }))
	);

	async function openPicker(day: Day) {
		pickingFor = day;
		selectedRecipe = data.candidates[0]?.id ?? '';

		// The dialog renders in response to the state change above, so focus has to wait
		// for that render. focusFirstField is a method rather than a prop because moving
		// focus is a one-shot action, not a state a prop could hold.
		await Promise.resolve();
		await modal?.focusFirstField();
	}

	const onAddMeal = (event: CustomEvent<string>) => {
		const day = event.detail;
		if (DAYS.includes(day as Day)) openPicker(day as Day);
	};

	function submitHidden(form: HTMLFormElement | undefined, values: Record<string, string>) {
		if (!form) return;
		for (const [name, value] of Object.entries(values)) {
			const field = form.elements.namedItem(name);
			if (field instanceof HTMLInputElement) field.value = value;
		}
		form.requestSubmit();
	}

	let removeForm = $state<HTMLFormElement>();
	let moveForm = $state<HTMLFormElement>();

	const onRemoveMeal = (event: CustomEvent<{ id: string; day: string }>) =>
		submitHidden(removeForm, { recipeId: event.detail.id, day: event.detail.day });

	const onMoveMeal = (event: CustomEvent<{ id: string; from: string; to: string }>) =>
		submitHidden(moveForm, {
			recipeId: event.detail.id,
			from: event.detail.from,
			to: event.detail.to
		});
</script>

<svelte:head>
	<title>Weekly planner — Brownie Bites</title>
	<meta name="description" content="Plan your meals for the week ahead." />
</svelte:head>

<!-- Escape closes the picker. Window-level, because the key press may land anywhere. -->
<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') pickingFor = null;
	}}
/>

<div class="page-head head-row">
	<div>
		<span class="eyebrow">This week</span>
		<h1>Weekly planner</h1>
		<p class="lede">
			Drag a meal between days, or use the move control on any card. Everything saves as you go.
		</p>
	</div>

	<p class="planned-count">
		<span class="planned-number">{plannedCount}</span>
		<span class="planned-label">{plannedCount === 1 ? 'meal' : 'meals'} planned</span>
	</p>
</div>

{#if data.vegOnly && data.hiddenCount > 0}
	<VegBanner>
		Veg Only mode is active. {data.hiddenCount === 1
			? 'One non-vegetarian meal'
			: `${data.hiddenCount} non-vegetarian meals`} scheduled in your weekly plan
		{data.hiddenCount === 1 ? 'is' : 'are'} temporarily hidden.
	</VegBanner>
{/if}

{#if data.candidates.length === 0}
	<div class="empty-state candidates-empty">
		<span class="empty-state-icon">
			<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
				<path d="M8 2v4M16 2v4M3 10h18" />
				<rect x="3" y="4" width="18" height="17" rx="2" />
			</svg>
		</span>
		<h2>Nothing to plan with yet</h2>
		<p>
			{#if data.vegOnly}
				Veg Only mode is on, and none of your saved recipes are vegetarian. Turn it off, or
				save a vegetarian recipe to assign it to a day.
			{:else}
				Favorite a few recipes or write one of your own — whatever you save becomes an option
				you can assign to a day.
			{/if}
		</p>
		<div class="empty-actions">
			<a class="button" href="/">Browse recipes</a>
			<a class="button secondary" href="/my-recipes/new">Create your own</a>
		</div>
	</div>
{/if}

<!--
	A failure inside one planner panel degrades that panel instead of blanking the route.
	This is the one page whose custom elements all take array properties, so it is where
	an upgrade failure would be most visible.
-->
<svelte:boundary>
	<div class="week">
		{#each data.week as slot (slot.day)}
			<!--
				`day-label` in kebab-case for the same reason as rp-recipe-card: an attribute
				written as dayLabel is lowercased by HTML and matches nothing. This route is
				client-rendered, so properties would be set correctly either way, but the
				markup should not depend on that.

				`dayLabels` and `meals` stay camelCase: object and array values have no
				attribute form at all and are only ever assigned as properties.
			-->
			<!--
				The heading uses the abbreviated label because a column stays narrow at the
				widths that matter — seven across, and narrower still once the grid steps
				down. `dayLabels` keeps the full names for the move control's options, where
				there is room for them.
			-->
			<rp-day-slot
				day={slot.day}
				day-label={DAY_LABELS_SHORT[slot.day]}
				dayLabels={DAY_LABELS}
				meals={slot.meals}
				days={[...DAYS]}
				onrpAddMeal={onAddMeal}
				onrpRemoveMeal={onRemoveMeal}
				onrpMoveMeal={onMoveMeal}
			>
				<p class="empty-day">Nothing planned</p>
			</rp-day-slot>
		{/each}
	</div>

	{#snippet failed(error, reset)}
		<div class="empty-state">
			<span class="empty-state-icon">
				<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 8v5M12 16.5v.01" />
				</svg>
			</span>
			<h2>The planner could not be displayed</h2>
			<p class="muted">{(error as Error)?.message ?? 'Unknown error'}</p>
			<button type="button" class="button" onclick={reset}>Try again</button>
		</div>
	{/snippet}
</svelte:boundary>

<rp-modal
	bind:this={modal}
	open={pickingFor !== null}
	heading="Add a meal to {pickingFor ? DAY_LABELS[pickingFor] : ''}"
	onrpClose={() => (pickingFor = null)}
>
	<!--
		States the rule up front. The list is deliberately limited to two sources, and
		without saying so the absence of a searched-for recipe reads as a missing feature
		rather than as the intended scope.
	-->
	<p class="picker-note">
		<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 11v5M12 8v.01" />
		</svg>
		<span>
			You can only add meals from <a href="/my-recipes">your recipes</a> and your
			<a href="/favorites">favorite recipes</a>.
		</span>
	</p>

	{#if data.candidates.length === 0}
		<p class="muted">You have no recipes to assign yet.</p>
	{:else}
		<span class="picker-label" id="recipe-label">Recipe</span>
		<!--
			`rp-select` rather than a native `<select>`: the browser draws a native dropdown
			through the operating system, so the open list keeps platform typography and a
			blue highlight regardless of this stylesheet, and on a phone it breaks out of
			this dialog entirely.
		-->
		<rp-select
			id="recipe"
			class="picker"
			label="Recipe"
			value={selectedRecipe}
			options={pickerOptions}
			onrpSelectChange={(event) => (selectedRecipe = event.detail)}
		></rp-select>
	{/if}

	<button type="button" class="button secondary" slot="footer" onclick={() => (pickingFor = null)}>
		Cancel
	</button>

	<form
		bind:this={assignForm}
		slot="footer"
		method="POST"
		action="?/assign"
		use:enhance={() => {
			const day = pickingFor;
			return async ({ update }) => {
				pickingFor = null;
				await update();
				toasts.push(`Added to ${day ? DAY_LABELS[day] : 'the plan'}`);
			};
		}}
	>
		<input type="hidden" name="day" value={pickingFor ?? ''} />
		<input type="hidden" name="recipeId" value={selectedRecipe} />
		<button type="submit" class="button" disabled={data.candidates.length === 0}>Add</button>
	</form>
</rp-modal>

<!--
	The day slot's controls live inside a custom element and cannot be submit buttons, so
	their events drive these forms instead. Both post the same actions a JS-less client
	would, keeping one server-side code path.
-->
<form
	bind:this={removeForm}
	method="POST"
	action="?/remove"
	class="hidden-form"
	use:enhance={() =>
		async ({ update }) => {
			await update();
			toasts.push('Meal removed');
		}}
>
	<input type="hidden" name="recipeId" />
	<input type="hidden" name="day" />
</form>

<form
	bind:this={moveForm}
	method="POST"
	action="?/move"
	class="hidden-form"
	use:enhance={() =>
		async ({ update }) => {
			await update();
			toasts.push('Meal moved');
		}}
>
	<input type="hidden" name="recipeId" />
	<input type="hidden" name="from" />
	<input type="hidden" name="to" />
</form>

<style>
	.head-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rp-space-4);
		align-items: flex-end;
		justify-content: space-between;
	}

	.planned-count {
		display: flex;
		gap: var(--rp-space-2);
		align-items: baseline;
		margin: 0;
		padding: var(--rp-space-3) var(--rp-space-5);
		background: var(--rp-color-surface);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-pill);
		box-shadow: var(--rp-shadow-xs);
	}

	.planned-number {
		font-family: var(--rp-font-serif);
		font-size: 1.5rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--rp-color-text);
	}

	.planned-label {
		font-size: var(--rp-font-size-sm);
		color: var(--rp-color-text-muted);
	}

	.candidates-empty {
		margin-bottom: var(--rp-space-6);
	}

	.empty-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rp-space-2);
		justify-content: center;
	}

	/**
	 * The planner shares the page measure with every other route, so the gutters match.
	 * A week across therefore gets whatever that measure allows — comfortable on a wide
	 * display, and still workable when it narrows because the day name can ellipsis, which
	 * `rp-day-slot` handles. Below the breakpoints the grid steps down rather than
	 * compressing seven columns into slivers.
	 */
	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: var(--rp-space-2);
		align-items: stretch;
	}

	@media (max-width: 1100px) {
		.week {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: var(--rp-space-3);
		}
	}

	@media (max-width: 780px) {
		.week {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 480px) {
		.week {
			grid-template-columns: 1fr;
		}
	}

	.empty-day {
		margin: 0;
		font-size: var(--rp-font-size-xs);
		color: var(--rp-color-text-subtle);
	}

	.picker-note {
		display: flex;
		gap: var(--rp-space-2);
		align-items: flex-start;
		margin: 0 0 var(--rp-space-5);
		padding: var(--rp-space-3) var(--rp-space-4);
		font-size: var(--rp-font-size-sm);
		line-height: 1.5;
		color: var(--rp-color-text-body);
		background: var(--rp-color-surface-sunken);
		border: 1px solid var(--rp-color-border);
		border-radius: var(--rp-radius-md);
	}

	.picker-note svg {
		flex-shrink: 0;
		/* Optically centres the glyph on the first line rather than on its own box. */
		margin-top: 2px;
		fill: none;
		stroke: var(--rp-color-highlight);
		stroke-width: 1.9;
		stroke-linecap: round;
	}

	.picker-note a {
		font-weight: 600;
		color: var(--rp-color-accent);
	}

	.picker-label {
		display: block;
		margin-bottom: var(--rp-space-2);
		font-size: var(--rp-font-size-xs);
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--rp-color-text-subtle);
	}

	/* `rp-select` brings its own trigger and list styling; the width is the app's business. */
	.picker {
		display: block;
		width: 100%;
	}

	.hidden-form {
		display: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.picker {
			transition: none;
		}
	}
</style>
