import type { Ingredient } from '$lib/recipe';

/**
 * Recipe input validation.
 *
 * Deliberately dependency-free and importable from both server and client, so the form
 * action and the browser check the same rules rather than drifting apart.
 */

export interface RecipeInput {
	title: string;
	category: string;
	area: string;
	instructions: string;
	image: string;
	ingredients: Ingredient[];
	isVeg: boolean;
}

export type RecipeErrors = Partial<Record<keyof RecipeInput, string>>;

export interface ValidationResult {
	valid: boolean;
	errors: RecipeErrors;
}

const TITLE_MIN = 3;
const TITLE_MAX = 80;
const INSTRUCTIONS_MIN = 20;

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

export function validateRecipe(input: RecipeInput): ValidationResult {
	const errors: RecipeErrors = {};

	const title = input.title.trim();
	if (title.length < TITLE_MIN) {
		errors.title = `Title must be at least ${TITLE_MIN} characters.`;
	} else if (title.length > TITLE_MAX) {
		errors.title = `Title must be ${TITLE_MAX} characters or fewer.`;
	}

	if (!input.category.trim()) {
		errors.category = 'Choose a category.';
	}

	if (input.instructions.trim().length < INSTRUCTIONS_MIN) {
		errors.instructions = `Instructions must be at least ${INSTRUCTIONS_MIN} characters.`;
	}

	// Optional, but a value that is present must be usable as an image source.
	if (input.image.trim() && !isHttpUrl(input.image.trim())) {
		errors.image = 'Image must be a valid http or https URL.';
	}

	const named = input.ingredients.filter((ingredient) => ingredient.name.trim());
	if (named.length === 0) {
		errors.ingredients = 'Add at least one ingredient.';
	} else if (named.some((ingredient) => !ingredient.measure.trim())) {
		errors.ingredients = 'Every ingredient needs a measure.';
	}

	return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Reads a recipe out of submitted form data.
 *
 * Ingredients arrive as parallel `ingredientName`/`ingredientMeasure` fields, which is
 * what a plain HTML form produces for a repeating group without JavaScript.
 */
export function recipeFromFormData(data: FormData): RecipeInput {
	const names = data.getAll('ingredientName').map(String);
	const measures = data.getAll('ingredientMeasure').map(String);

	return {
		title: String(data.get('title') ?? ''),
		category: String(data.get('category') ?? ''),
		area: String(data.get('area') ?? ''),
		instructions: String(data.get('instructions') ?? ''),
		image: String(data.get('image') ?? ''),
		ingredients: names
			.map((name, index) => ({ name, measure: measures[index] ?? '' }))
			.filter((ingredient) => ingredient.name.trim() || ingredient.measure.trim()),
		// An unchecked checkbox submits no field at all, so absence is the false case.
		// There is no rule for this in `validateRecipe`: both answers are valid.
		isVeg: data.get('isVeg') !== null
	};
}
