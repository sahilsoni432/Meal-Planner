import { applyVegFilter, isLocal, rawId, toSummary, type RecipeSummary } from '$lib/recipe';
import { lookupRecipe } from '$lib/server/mealdb';
import { read } from '$lib/server/store';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, cookies, depends }) => {
	depends(VEG_DEPENDENCY);

	const { favorites, recipes } = read(cookies);
	const vegOnly = parseVegOnly(cookies.get(VEG_COOKIE));

	// Favorites is a flat list mixing both sources, so each id is resolved against the
	// system that owns it. Local recipes need no request.
	const resolved = await Promise.all(
		favorites.map(async (id): Promise<RecipeSummary | null> => {
			if (isLocal(id)) {
				const own = recipes.find((recipe) => recipe.id === id);
				return own ? toSummary(own) : null;
			}

			const recipe = await lookupRecipe(fetch, rawId(id));
			return recipe ? toSummary(recipe) : null;
		})
	);

	// A favorite can outlive the recipe it points at, so unresolvable ids are dropped
	// rather than rendered as broken cards.
	const available = resolved.filter((recipe) => recipe !== null);
	const visible = applyVegFilter(available, vegOnly);

	return {
		recipes: visible,
		favorites,
		vegOnly,
		// How many saved recipes the filter is holding back, so the page can say so rather
		// than looking as though favorites were lost.
		hiddenCount: available.length - visible.length
	};
};
