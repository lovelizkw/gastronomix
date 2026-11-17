import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  cookRecipe,
  getRecipe,
  getSubstitutes,
  listProducts,
  toggleFavorite,
  type RecipeRow,
  type SubstituteMap,
} from "@/lib/kitchen-api";
import { matchInfo } from "@/lib/recipes";

export const Route = createFileRoute("/recipes/$recipeId")({
  component: RecipePage,
});

/**
 * Умножает числа в количестве на коэффициент порций: «200 г» → «400 г».
 * Штуки округляются к половине, граммы и миллилитры — к целым.
 */
function scaleAmount(amount: string, factor: number): string {
  if (factor === 1) return amount;
  return amount.replace(
    /(\d+(?:[.,]\d+)?)\s*(шт|г|гр|мл|кг|л|ст\.?\s*л|ч\.?\s*л|упак|зубчик|зубчика)?/gi,
    (m, num: string, unit: string | undefined) => {
      const value = Number(num.replace(",", ".")) * factor;
      if (!unit) return String(Math.round(value * 2) / 2).replace(".", ",");
      const rounded = /шт|зубчик|упак/i.test(unit)
        ? Math.round(value * 2) / 2
        : Math.round(value);
      const text = String(rounded).replace(".", ",");
      return `${text} ${unit}`;
    },
  );
}

/** Читает «варить 12 минут» и превращает в кнопки-таймеры. */
function findDurations(text: string): { label: string; seconds: number }[] {
  const result: { label: string; seconds: number }[] = [];
  const matches = text.matchAll(/(\d+)\s*(секунд|сек|минут|мин)/gi);
  for (const m of matches) {
    const value = Number(m[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const isSeconds = /сек/i.test(m[2]);
    result.push({
      label: `${value} ${isSeconds ? "сек" : "мин"}`,
      seconds: isSeconds ? value : value * 60,
    });
  }
  return result;
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Подсказка «Чем заменить?»: первый недостающий ингредиент, для которого
 * в таблице эквивалентов есть замена, уже лежащая в холодильнике.
 */
function findSubstitution(
  missing: string[],
  productNames: string[],
  substitutes: SubstituteMap,
): { missing: string; replacement: string } | null {
  const lower = productNames.map((p) => p.toLowerCase());
  for (const ingredient of missing) {
    const low = ingredient.toLowerCase();
    for (const [key, options] of Object.entries(substitutes)) {
      if (!low.includes(key)) continue;
      const present = options.find((o) => lower.some((p) => p.includes(o.toLowerCase())));
      if (present) return { missing: ingredient, replacement: present };
    }
  }
  return null;
}

function RecipePage() {
  const { recipeId } = Route.useParams();
  const id = Number(recipeId);
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [recipe, setRecipe] = useState<RecipeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [cookMessage, setCookMessage] = useState("");
  const [cookError, setCookError] = useState("");
  const [cookBusy, setCookBusy] = useState(false);
  const [products, setProducts] = useState<{ name: string }[]>([]);
  const [substitutes, setSubstitutes] = useState<SubstituteMap>({});
  const [portions, setPortions] = useState(2);
  const [chefOpen, setChefOpen] = useState(false);

  useEffect(() => {
    if (!userId || !Number.isFinite(id)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getRecipe({ data: { id } })
      .then((row) => {
        if (!cancelled && row) {
          setRecipe(row);
          setPortions(row.portions);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    listProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows.map((r) => ({ name: r.name })));
      })
      .catch(() => null);
    getSubstitutes()
      .then((map) => {
        if (!cancelled) setSubstitutes(map);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [userId, id]);

  const productNames = useMemo(() => products.map((p) => p.name), [products]);
  const match = useMemo(
    () => (recipe ? matchInfo(recipe, productNames) : null),
    [recipe, productNames],
  );
  const substitution = useMemo(
    () =>
      recipe && match
        ? findSubstitution(match.missing, productNames, substitutes)
        : null,
    [recipe, match, productNames, substitutes],
  );
  const portionFactor = recipe ? portions / (recipe.portions || 1) : 1;

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onToggleFavorite() {
    if (!recipe) return;
    const result = await toggleFavorite({ data: { id: recipe.id } });
    setRecipe({ ...recipe, favorite: result.favorite });
  }

  /** Автосписание: вычитает ингредиенты рецепта из холодильника. */
  async function onCook() {
    if (!recipe) return;
    setCookMessage("");
    setCookError("");
    setCookBusy(true);
    try {
      const result = await cookRecipe({ data: { id: recipe.id } });
      const usedText = result.used.map((u) => `${u.name} (−${u.deducted})`).join(", ");
      const notes: string[] = [];
      if (result.missing.length) notes.push(`не нашлось: ${result.missing.join(", ")}`);
      if (result.skipped.length) notes.push(`не списано (единицы): ${result.skipped.join("; ")}`);
      setCookMessage(
        usedText || notes.length
          ? [usedText ? `Списано: ${usedText}.` : "", ...notes].filter(Boolean).join(" ")
          : "В рецепте нет ингредиентов с точным количеством.",
      );
    } catch {
      setCookError("Не получилось списать продукты. Попробуйте ещё раз.");
    } finally {
      setCookBusy(false);
    }
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
                    {recipe.cuisine ? ` · ${recipe.cuisine} кухня` : ""}
                    {recipe.mine ? " · ваш рецепт" : " · каталог"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex gap-2">
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
                    <button
                      type="button"
                      onClick={() => setChefOpen(true)}
                      className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-cream"
                    >
                      Режим шеф-повара
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onCook}
                    disabled={cookBusy}
                    className="min-h-11 rounded-full bg-sage-deep px-5 text-sm font-medium text-cream disabled:opacity-40"
                  >
                    {cookBusy ? "Списываем…" : "Я приготовил это"}
                  </button>
                  {cookMessage ? (
                    <p className="max-w-xs text-right text-xs text-sage-deep">{cookMessage}</p>
                  ) : null}
                  {cookError ? (
                    <p className="max-w-xs text-right text-xs text-red-700">{cookError}</p>
                  ) : null}
                </div>
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

                  {/* Динамический пересчёт порций */}
                  <div className="mt-4 rounded-lg bg-cream p-4">
                    <label className="block text-sm font-medium">
                      На сколько человек готовим? {portions}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={portions}
                      onChange={(e) => setPortions(Number(e.target.value))}
                      className="mt-2 w-full accent-sage-deep"
                    />
                  </div>

                  <ul className="mt-4 grid gap-2 text-sm">
                    {recipe.ingredients.map((ing, i) => {
                      const amountText = scaleAmount(ing.amount, portionFactor);
                      const hasIt = productNames.some(
                        (p) =>
                          p.toLowerCase().includes(ing.name.toLowerCase()) ||
                          ing.name.toLowerCase().includes(p.toLowerCase()),
                      );
                      return (
                        <li
                          key={i}
                          className="flex justify-between gap-4 border-b border-line/70 pb-2"
                        >
                          <span className={hasIt ? "" : "text-blush-deep"}>{ing.name}</span>
                          {ing.amount ? (
                            <span className={hasIt ? "text-muted" : "font-medium text-blush-deep"}>
                              {amountText}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {portionFactor !== 1 ? (
                    <p className="mt-2 text-xs text-muted">
                      Количество пересчитано на {portions}{" "}
                      {portions === 1 ? "порцию" : "порции"}. Красным — продуктов не хватает.
                    </p>
                  ) : null}
                  {substitution ? (
                    <p className="mt-4 rounded-md bg-lilac/30 p-3 text-sm">
                      Нет {substitution.missing}? Замените на{" "}
                      <span className="font-medium">{substitution.replacement}</span> — он есть
                      у вас дома.
                    </p>
                  ) : null}
                </section>

                <section>
                  <h2 className="font-serif text-2xl">Как готовить</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">
                    {recipe.instructions || "Описание приготовления пока не добавлено."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setChefOpen(true)}
                    className="mt-4 min-h-11 rounded-full bg-sage px-5 text-sm font-medium text-ink"
                  >
                    Готовить по шагам
                  </button>
                </section>
              </div>
            </div>
          </article>
        )}
      </div>

      {recipe && chefOpen ? (
        <ChefMode recipe={recipe} onClose={() => setChefOpen(false)} />
      ) : null}
    </main>
  );
}

/** Полноэкранный режим готовки: крупные шаги, галочки и таймеры. */
function ChefMode({ recipe, onClose }: { recipe: RecipeRow; onClose: () => void }) {
  const steps = useMemo(
    () =>
      (recipe.instructions || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [recipe.instructions],
  );
  const [done, setDone] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState<{ label: string; seconds: number } | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return undefined;
    intervalRef.current = window.setInterval(() => {
      setTimer((t) => (t && t.seconds > 1 ? { ...t, seconds: t.seconds - 1 } : null));
    }, 1000);
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [timer?.label, timer?.seconds]);

  function toggleStep(index: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const progress = steps.length > 0 ? Math.round((done.size / steps.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink text-cream">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cream/60">Режим шеф-повара</p>
            <h1 className="mt-1 font-display text-4xl font-light md:text-6xl">
              {recipe.title.toUpperCase()}
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-full bg-cream px-6 text-sm font-medium text-ink"
          >
            Выйти
          </button>
        </div>

        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-cream/20">
          <div
            className="h-full rounded-full bg-sage-deep transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-cream/70">
          {done.size} из {steps.length} шагов
        </p>

        <ol className="mt-8 grid gap-5">
          {steps.map((step, index) => {
            const durations = findDurations(step);
            const isDone = done.has(index);
            return (
              <li
                key={index}
                className={`rounded-lg p-5 transition-colors ${
                  isDone ? "bg-cream/10 opacity-60" : "bg-cream/5"
                }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleStep(index)}
                    className="mt-1 size-6"
                    aria-label={`Шаг ${index + 1}`}
                  />
                  <p className="text-2xl leading-relaxed">{step.replace(/^\d+\.\s*/, "")}</p>
                </div>
                {durations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 pl-10">
                    {durations.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTimer({ label: d.label, seconds: d.seconds })}
                        className="min-h-10 rounded-full bg-sage-deep px-4 text-sm font-medium text-cream"
                      >
                        ⏱ {d.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {steps.length === 0 ? (
          <p className="mt-10 text-xl text-cream/70">У рецепта пока нет пошагового описания.</p>
        ) : null}
      </div>

      {timer ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-blush px-6 py-4 text-ink shadow-lg">
          <p className="text-sm font-medium">
            ⏱ {timer.label} — {formatTime(timer.seconds)}
          </p>
          <button
            type="button"
            onClick={() => setTimer(null)}
            className="mt-1 text-xs underline"
          >
            остановить
          </button>
        </div>
      ) : null}
    </div>
  );
}
