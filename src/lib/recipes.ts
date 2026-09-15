import type { RecipeRow } from "@/lib/kitchen-api";

export function matchRecipes(recipes: RecipeRow[], productNames: string[]): RecipeRow[] {
  const names = productNames.map((n) => n.toLowerCase());
  if (names.length === 0) return recipes;
  const scored = recipes.map((recipe) => {
    const hits = recipe.ingredients.filter((ing) =>
      names.some((p) => p.includes(ing.toLowerCase()) || ing.toLowerCase().includes(p)),
    ).length;
    return { recipe, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);
  const withHits = scored.filter((s) => s.hits > 0).map((s) => s.recipe);
  return withHits.length ? withHits : recipes;
}
