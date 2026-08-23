import { error } from '@sveltejs/kit';
import { isLocal, rawId } from '$lib/recipe';
import { lookupRecipe } from '$lib/server/mealdb';
import { read } from '$lib/server/store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	if (isLocal(params.id)) {
		const { recipes } = read(cookies);
		const own = recipes.find((recipe) => recipe.id === params.id);

		if (!own) error(404, 'That recipe does not exist.');
		return { recipe: own };
	}

	const recipe = await lookupRecipe(fetch, rawId(params.id));

	// TheMealDB answers an unknown id with `meals: null` and a 200, so the missing case
	// has to be translated into a real 404 here.
	if (!recipe) error(404, 'That recipe does not exist.');

	return { recipe };
};
