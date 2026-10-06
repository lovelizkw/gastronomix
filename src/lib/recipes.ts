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
