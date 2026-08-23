import {
	isVegCategory,
	toSummary,
	type Ingredient,
	type Recipe,
	type RecipeSummary
} from '$lib/recipe';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

/** The flat shape TheMealDB returns; ingredients arrive as 20 numbered field pairs. */
interface MealDbMeal {
	idMeal: string;
	strMeal: string;
	strCategory: string | null;
	strArea: string | null;
	strInstructions: string | null;
	strMealThumb: string | null;
	[key: string]: string | null;
}

/** The reduced shape returned by filter.php, which omits category and instructions. */
interface MealDbSummary {
	idMeal: string;
	strMeal: string;
	strMealThumb: string | null;
}

type Fetch = typeof globalThis.fetch;

async function query<T>(fetchFn: Fetch, path: string): Promise<{ meals: T[] | null }> {
	const response = await fetchFn(`${BASE}/${path}`);
	if (!response.ok) {
		throw new Error(`TheMealDB responded ${response.status} for ${path}`);
	}
	return response.json();
}

function collectIngredients(meal: MealDbMeal): Ingredient[] {
	const ingredients: Ingredient[] = [];

	for (let slot = 1; slot <= 20; slot++) {
		const name = meal[`strIngredient${slot}`]?.trim();
		// Slots are not densely packed — a recipe can leave gaps mid-sequence, so an
		// empty slot must be skipped rather than treated as the end of the list.
		if (!name) continue;

		ingredients.push({ name, measure: meal[`strMeasure${slot}`]?.trim() ?? '' });
	}

	return ingredients;
}

function normalizeRecipe(meal: MealDbMeal): Recipe {
	const category = meal.strCategory ?? 'Uncategorized';

	return {
		id: `api:${meal.idMeal}`,
		title: meal.strMeal,
		category,
		area: meal.strArea ?? '',
		instructions: meal.strInstructions ?? '',
		image: meal.strMealThumb ?? '',
		ingredients: collectIngredients(meal),
		source: 'api',
		// TheMealDB carries no vegetarian flag, so this is inferred from the category.
		isVeg: isVegCategory(category)
	};
}

/**
 * `category` is carried in from the caller because filter.php does not return it, and
 * looking it up per card would mean one request per grid item.
 *
 * `isVeg` is passed separately rather than derived from `category` here, because the
 * area-filtered path puts a cuisine in the category slot — deriving from it would mark
 * every Italian or Indian result non-vegetarian regardless of what the dish is.
 */
function normalizeSummary(meal: MealDbSummary, category: string, isVeg: boolean): RecipeSummary {
	return {
		id: `api:${meal.idMeal}`,
		title: meal.strMeal,
		category,
		image: meal.strMealThumb ?? '',
		source: 'api',
		isVeg
	};
}

export async function searchRecipes(fetchFn: Fetch, term: string): Promise<Recipe[]> {
	const { meals } = await query<MealDbMeal>(fetchFn, `search.php?s=${encodeURIComponent(term)}`);
	return (meals ?? []).map(normalizeRecipe);
}

export async function lookupRecipe(fetchFn: Fetch, id: string): Promise<Recipe | null> {
	const { meals } = await query<MealDbMeal>(fetchFn, `lookup.php?i=${encodeURIComponent(id)}`);
	// An unknown id yields `meals: null` rather than a 404, so the caller cannot rely on
	// the HTTP status to detect a missing recipe.
	return meals?.[0] ? normalizeRecipe(meals[0]) : null;
}

export async function filterByCategory(fetchFn: Fetch, category: string): Promise<RecipeSummary[]> {
	const { meals } = await query<MealDbSummary>(
		fetchFn,
		`filter.php?c=${encodeURIComponent(category)}`
	);
	const isVeg = isVegCategory(category);
	return (meals ?? []).map((meal) => normalizeSummary(meal, category, isVeg));
}

/**
 * Filtering by cuisine returns no category, so a dish's veg status cannot be inferred the
 * way the category path infers it.
 *
 * `vegOnly` decides how much work that is worth. Off, the grid needs no veg data at all
 * and the summaries are returned as they arrive — one request. On, each result is looked
 * up for its real category, because the alternative is defaulting them to non-vegetarian
 * and emptying the grid. That is the N+1 the rest of this module avoids, and it is
 * accepted only on the path that cannot work without it. Requests run concurrently, and a
 * lookup that fails leaves that one card out of the veg listing rather than failing the
 * page.
 */
export async function filterByArea(
	fetchFn: Fetch,
	area: string,
	vegOnly = false
): Promise<RecipeSummary[]> {
	const { meals } = await query<MealDbSummary>(fetchFn, `filter.php?a=${encodeURIComponent(area)}`);
	const summaries = meals ?? [];

	if (!vegOnly) return summaries.map((meal) => normalizeSummary(meal, area, false));

	const resolved = await Promise.all(
		summaries.map(async (meal): Promise<RecipeSummary | null> => {
			try {
				const full = await lookupRecipe(fetchFn, meal.idMeal);
				return full ? toSummary(full) : null;
			} catch {
				return null;
			}
		})
	);

	return resolved.filter((recipe) => recipe !== null);
}

export async function listCategories(fetchFn: Fetch): Promise<string[]> {
	const { meals } = await query<{ strCategory: string }>(fetchFn, 'list.php?c=list');
	return (meals ?? []).map((meal) => meal.strCategory);
}

export async function listAreas(fetchFn: Fetch): Promise<string[]> {
	const { meals } = await query<{ strArea: string }>(fetchFn, 'list.php?a=list');
	return (meals ?? []).map((meal) => meal.strArea);
}
