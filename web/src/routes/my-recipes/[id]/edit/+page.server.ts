import { error, fail, redirect } from '@sveltejs/kit';
import { listCategories } from '$lib/server/mealdb';
import { read, StoreFullError, write } from '$lib/server/store';
import { parseVegOnly, VEG_COOKIE, VEG_DEPENDENCY } from '$lib/vegMode';
import { recipeFromFormData, validateRecipe } from '$lib/validate';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, cookies, depends }) => {
	depends(VEG_DEPENDENCY);

	const categories = await listCategories(fetch);
	const { recipes } = read(cookies);
	const recipe = recipes.find((candidate) => candidate.id === params.id);

	// Only user-created recipes are editable; an API recipe has no local record.
	if (!recipe) error(404, 'That recipe does not exist, or is not one of yours.');

	return { recipe, categories, vegOnly: parseVegOnly(cookies.get(VEG_COOKIE)) };
};

export const actions: Actions = {
	default: async ({ params, request, cookies, url }) => {
		const data = await request.formData();
		const input = recipeFromFormData(data);
		const { valid, errors } = validateRecipe(input);

		if (!valid) return fail(400, { values: input, errors });

		let found = false;

		try {
			write(
				cookies,
				(store) => {
					store.recipes = store.recipes.map((recipe) => {
						if (recipe.id !== params.id) return recipe;

						found = true;
						return {
							...recipe,
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
							isVeg: input.isVeg
						};
					});
				},
				url
			);
		} catch (err) {
			if (err instanceof StoreFullError) {
				return fail(400, { values: input, errors: { title: err.message } });
			}
			throw err;
		}

		if (!found) error(404, 'That recipe does not exist.');

		redirect(303, '/my-recipes');
	}
};
