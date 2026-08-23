<script lang="ts">
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import type { RecipeInput } from '$lib/validate';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const blank: RecipeInput = $derived({
		title: '',
		category: '',
		area: '',
		instructions: '',
		image: '',
		ingredients: [],
		// Defaults on when the filter is on, so the common case matches what the user is
		// currently browsing and the warning does not fire on an untouched form.
		isVeg: data.vegOnly
	});

	// After a failed submit the action returns what was typed, so nothing is lost.
	const values = $derived(form?.values ?? blank);
</script>

<svelte:head>
	<title>Add a recipe — Brownie Bites</title>
</svelte:head>

<nav class="breadcrumb">
	<a href="/my-recipes">My recipes</a>
	<span aria-hidden="true">/</span>
	<span>New</span>
</nav>

<div class="page-head">
	<h1>Add a recipe</h1>
	<p class="lede">Write it down once and it joins your collection, your favorites, and your plan.</p>
</div>

<!--
	Keyed on whether a submission failed, not on `values` itself. Keying on `values` would
	remount the form on every change to the action result — including a successful submit,
	where the result reverts to the blank default and would wipe the fields mid-flight.
-->
{#key form ? 'retry' : 'fresh'}
	<RecipeForm
		{values}
		errors={form?.errors}
		categories={data.categories}
		vegOnly={data.vegOnly}
		submitLabel="Save recipe"
	/>
{/key}

<style>
	.page-head h1 {
		font-size: clamp(1.625rem, 1.3rem + 1.6vw, 2.125rem);
	}
</style>
