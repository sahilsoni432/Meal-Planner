<script lang="ts">
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import type { RecipeInput } from '$lib/validate';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const stored: RecipeInput = $derived({
		title: data.recipe.title,
		category: data.recipe.category,
		area: data.recipe.area,
		instructions: data.recipe.instructions,
		image: data.recipe.image,
		ingredients: data.recipe.ingredients,
		isVeg: data.recipe.isVeg
	});

	const values = $derived(form?.values ?? stored);
</script>

<svelte:head>
	<title>Edit {data.recipe.title} — Brownie Bites</title>
</svelte:head>

<nav class="breadcrumb">
	<a href="/my-recipes">My recipes</a>
	<span aria-hidden="true">/</span>
	<span>Edit</span>
</nav>

<div class="page-head">
	<h1>Edit recipe</h1>
	<p class="lede">Changes to <strong>{data.recipe.title}</strong> save straight away.</p>
</div>

<!-- Keyed on the recipe being edited, so navigating between two edit pages remounts. -->
{#key data.recipe.id}
	<RecipeForm
		{values}
		errors={form?.errors}
		categories={data.categories}
		vegOnly={data.vegOnly}
		submitLabel="Save changes"
	/>
{/key}

<style>
	.page-head h1 {
		font-size: clamp(1.625rem, 1.3rem + 1.6vw, 2.125rem);
	}
</style>
