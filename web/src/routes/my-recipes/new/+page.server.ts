import { fail, redirect } from '@sveltejs/kit';
import type { Recipe } from '$lib/recipe';
import { listCategories } from '$lib/server/mealdb';
import { StoreFullError, write } from '$lib/server/store';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import { recipeFromFormData, validateRecipe } from '$lib/validate';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, cookies, depends }) => {
	depends(VEG_DEPENDENCY);

	return {
		categories: await listCategories(fetch),
		vegOnly: parseVegOnly(cookies.get(VEG_COOKIE))
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const input = recipeFromFormData(data);
		const { valid, errors } = validateRecipe(input);

		// Echoing the submitted values back means a failed submit without JavaScript
		// re-renders the form with the user's input intact.
		if (!valid) return fail(400, { values: input, errors });

		const recipe: Recipe = {
			id: `usr:${crypto.randomUUID().slice(0, 8)}`,
			title: input.title.trim(),
			category: input.category.trim(),
			area: input.area.trim(),
			instructions: input.instructions.trim(),
			image: input.image.trim(),
			ingredients: input.ingredients
				.filter((ingredient) => ingredient.name.trim())
				.map((ingredient) => ({
					name: ingredient.name.trim(),
					measure: ingredient.measure.trim()
				})),
			source: 'local',
			isVeg: input.isVeg
		};

		try {
			write(
				cookies,
				(store) => {
					store.recipes = [recipe, ...store.recipes];
				},
				url
			);
		} catch (error) {
			// The store is capped, so a save can legitimately not fit. Return the input so
			// nothing the user typed is lost.
			if (error instanceof StoreFullError) {
				return fail(400, { values: input, errors: { title: error.message } });
			}
			throw error;
		}

		redirect(303, '/my-recipes');
	}
};
