import { fail, redirect } from '@sveltejs/kit';
import {
	filterByArea,
	filterByCategory,
	listAreas,
	listCategories,
	searchRecipes
} from '$lib/server/mealdb';
import { applyVegFilter, toSummary, type RecipeSummary } from '$lib/recipe';
import { read, StoreFullError, write } from '$lib/server/store';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import type { Actions, PageServerLoad } from './$types';

/** Shown as browse rows when no query or filter is active. */
const BROWSE_CATEGORIES = ['Chicken', 'Seafood', 'Dessert', 'Vegetarian'];

/**
 * Browse rows for Veg Only. The default set is half meat, so on a filtered page four rows
 * would collapse to two — this substitutes categories that have something in them.
 */
const VEG_BROWSE_CATEGORIES = ['Vegetarian', 'Vegan', 'Pasta', 'Dessert'];

export interface BrowseRow {
	category: string;
	recipes: RecipeSummary[];
}

export const load: PageServerLoad = async ({ url, fetch, cookies, depends }) => {
	depends(VEG_DEPENDENCY);

	const query = url.searchParams.get('q')?.trim() ?? '';
	const category = url.searchParams.get('category') ?? '';
	const area = url.searchParams.get('area') ?? '';

	// Both lists are small, cached by the CDN, and needed by the filter controls in every
	// state, so they are fetched alongside whichever result set applies.
	const [categories, areas] = await Promise.all([listCategories(fetch), listAreas(fetch)]);
	const { favorites } = read(cookies);
	const vegOnly = parseVegOnly(cookies.get(VEG_COOKIE));

	if (query) {
		const results = await searchRecipes(fetch, query);
		return {
			mode: 'search' as const,
			query,
			category,
			area,
			categories,
			areas,
			favorites,
			vegOnly,
			results: applyVegFilter(results.map(toSummary), vegOnly),
			rows: [] as BrowseRow[]
		};
	}

	if (category || area) {
		const results = category
			? await filterByCategory(fetch, category)
			: // Only the cuisine path needs the flag: it has no category to infer from, so
				// it resolves each result when the filter is on. See `filterByArea`.
				await filterByArea(fetch, area, vegOnly);

		return {
			mode: 'filter' as const,
			query,
			category,
			area,
			categories,
			areas,
			favorites,
			vegOnly,
			results: applyVegFilter(results, vegOnly),
			rows: [] as BrowseRow[]
		};
	}

	// An empty search returns nothing from TheMealDB, so the landing page browses by
	// category instead of rendering a blank grid.
	const browseCategories = vegOnly ? VEG_BROWSE_CATEGORIES : BROWSE_CATEGORIES;
	const rows = await Promise.all(
		browseCategories.map(async (name) => ({
			category: name,
			recipes: applyVegFilter(await filterByCategory(fetch, name), vegOnly).slice(0, 8)
		}))
	);

	return {
		mode: 'browse' as const,
		query,
		category,
		area,
		categories,
		areas,
		favorites,
		vegOnly,
		results: [] as RecipeSummary[],
		// A substituted category that still comes back empty should not leave a bare
		// heading with nothing beneath it.
		rows: rows.filter((row) => row.recipes.length > 0)
	};
};

export const actions: Actions = {
	/**
	 * Toggles a favorite and returns to the page that submitted.
	 *
	 * Defined here rather than per route so every grid in the application posts to one
	 * action. `redirectTo` preserves the caller's query string, which matters without
	 * JavaScript where the browser follows the redirect.
	 */
	toggleFavorite: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const recipeId = String(data.get('recipeId') ?? '');
		const redirectTo = String(data.get('redirectTo') ?? '/');

		if (!recipeId) return fail(400, { message: 'A recipe id is required.' });

		try {
			write(
				cookies,
				(store) => {
					store.favorites = store.favorites.includes(recipeId)
						? store.favorites.filter((id) => id !== recipeId)
						: [...store.favorites, recipeId];
				},
				url
			);
		} catch (error) {
			if (error instanceof StoreFullError) return fail(400, { message: error.message });
			throw error;
		}

		redirect(303, redirectTo);
	}
};
