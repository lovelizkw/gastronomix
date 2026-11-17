import type { RecipeRow } from "@/lib/kitchen-api";

/**
 * Сопоставляет рецепты с продуктами из «Холодильника»: чем больше ингредиентов
 * рецепта совпало с продуктами пользователя, тем выше блюдо в выдаче.
 * Если совпадений нет вовсе — показываем весь каталог.
 */
export function matchRecipes(recipes: RecipeRow[], productNames: string[]): RecipeRow[] {
  const names = productNames.map((n) => n.toLowerCase());
  if (names.length === 0) return recipes;
  const scored = recipes.map((recipe) => {
    const hits = recipe.ingredients.filter((ing) =>
      names.some((p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p)),
    ).length;
    return { recipe, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);
  const withHits = scored.filter((s) => s.hits > 0).map((s) => s.recipe);
  return withHits.length ? withHits : recipes;
}

/**
 * Процент совпадения одного рецепта с холодильником: сколько ингредиентов
 * есть дома (hits) из общего числа (total). Используется для подписи
 * «5 из 6 — не хватает только сметаны».
 */
export function matchInfo(
  recipe: RecipeRow,
  productNames: string[],
): { hits: number; total: number; missing: string[] } {
  const names = productNames.map((n) => n.toLowerCase());
  const hits = recipe.ingredients.filter((ing) =>
    names.some((p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p)),
  ).length;
  const missing = recipe.ingredients.filter(
    (ing) => !names.some((p) => p.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(p)),
  ).map((ing) => ing.name);
  return { hits, total: recipe.ingredients.length, missing };
}
