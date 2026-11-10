import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getRecipe, toggleFavorite, type RecipeRow } from "@/lib/kitchen-api";

export const Route = createFileRoute("/recipes/$recipeId")({
  component: RecipePage,
});

function RecipePage() {
  const { recipeId } = Route.useParams();
  const id = Number(recipeId);
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [recipe, setRecipe] = useState<RecipeRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !Number.isFinite(id)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getRecipe({ data: { id } })
      .then((row) => {
        if (!cancelled) setRecipe(row);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, id]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onToggleFavorite() {
    if (!recipe) return;
    const result = await toggleFavorite({ data: { id: recipe.id } });
    setRecipe({ ...recipe, favorite: result.favorite });
  }

  return (
    <main className="min-h-svh bg-cream">
      <header className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
        <Link to="/" className="font-display text-sm tracking-[0.28em] uppercase">
          Gastronomix
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/kitchen"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Кухня
          </Link>
          <Link
            to="/profile"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Профиль
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10">
        <Link to="/kitchen" className="text-sm text-muted underline">
          ← Назад к рецептам
        </Link>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Загружаем рецепт…</p>
        ) : !recipe ? (
          <div className="mt-8 border border-dashed border-line px-6 py-16 text-center">
            <p className="font-serif text-3xl">Рецепт не найден</p>
            <p className="mt-2 text-sm text-muted">
              Возможно, он был удалён или принадлежит другому пользователю
            </p>
          </div>
        ) : (
          <article className="mt-6 overflow-hidden rounded-lg bg-paper">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="h-64 w-full object-cover md:h-96"
            />
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-4xl font-light tracking-tight text-sage-deep md:text-5xl">
                    {recipe.title.toUpperCase()}
                  </h1>
                  <p className="mt-2 text-sm text-muted">
                    {recipe.timeLabel} · {recipe.portions} порц.
                    {recipe.mine ? " · ваш рецепт" : " · каталог"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  aria-pressed={recipe.favorite}
                  className={`min-h-11 rounded-full px-5 text-sm font-medium ${
                    recipe.favorite ? "bg-blush text-ink" : "bg-sage/50 text-ink"
                  }`}
                >
                  {recipe.favorite ? "♥ В избранном" : "♡ В избранное"}
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-sm font-medium">
                <span className="rounded-full bg-sage px-4 py-2">{recipe.kbju.k} ккал</span>
                <span className="rounded-full bg-sage/50 px-4 py-2">Белки {recipe.kbju.b} г</span>
                <span className="rounded-full bg-sage/50 px-4 py-2">Жиры {recipe.kbju.j} г</span>
                <span className="rounded-full bg-sage/50 px-4 py-2">
                  Углеводы {recipe.kbju.u} г
                </span>
              </div>

              <div className="mt-8 grid gap-8 md:grid-cols-2">
                <section>
                  <h2 className="font-serif text-2xl">Ингредиенты</h2>
                  <ul className="mt-3 grid gap-2 text-sm">
                    {recipe.ingredients.map((ing, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-4 border-b border-line/70 pb-2"
                      >
                        <span>{ing.name}</span>
                        {ing.amount ? <span className="text-muted">{ing.amount}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="font-serif text-2xl">Как готовить</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">
                    {recipe.instructions || "Описание приготовления пока не добавлено."}
                  </p>
                </section>
              </div>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
