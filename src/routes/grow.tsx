import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  generateRecipes,
  saveGeneratedRecipes,
  type GeneratedRecipe,
} from "@/lib/llm-api";

export const Route = createFileRoute("/grow")({ component: GrowPage });

function GrowPage() {
  const { user, isPending } = useCurrentUserState();
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [created, setCreated] = useState<string[]>([]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated([]);
    setRecipes([]);
    setChosen(new Set());
    try {
      const result = await generateRecipes({ data: { theme: theme.trim() } });
      setRecipes(result);
      setChosen(new Set(result.map((_, i) => i)));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).slice(0, 200));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (chosen.size === 0) return;
    setSaving(true);
    setError("");
    try {
      const picked = recipes.filter((_, i) => chosen.has(i));
      const result = await saveGeneratedRecipes({ data: { recipes: picked } });
      setCreated(result.created);
      setRecipes([]);
      setChosen(new Set());
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).slice(0, 200));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-svh bg-cream">
      <header className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
        <Link to="/" className="font-display text-sm tracking-[0.28em] uppercase">
          Gastronomix
        </Link>
        <Link
          to="/kitchen"
          className="min-h-11 rounded-full bg-cream px-4 py-2 text-sm text-ink"
        >
          Кухня
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-xs uppercase tracking-[0.3em] text-sage-deep">✨ Шеф-ИИ</p>
        <h1 className="mt-2 font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
          РАСШИРИТЬ КАТАЛОГ
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Опишите тему — и шеф-ИИ придумает 5 рецептов с граммовками и шагами.
          Отметьте понравившиеся, и они появятся в общем каталоге.
        </p>

        <form onSubmit={onGenerate} className="mt-8 flex flex-wrap gap-2">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            required
            minLength={2}
            maxLength={120}
            placeholder="Например: бюджетные ужины из курицы"
            className="min-h-12 min-w-64 flex-1 rounded-md border border-line bg-paper px-4"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-full bg-ink px-8 font-medium text-cream disabled:opacity-40"
          >
            {busy ? "Шеф думает…" : "Придумать"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {["лёгкие обеды на каждый день", "кавказская кухня", "ужин за 20 минут", "десерты к чаю"].map(
            (t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className="min-h-9 rounded-full border border-line bg-paper px-3 text-xs text-muted"
              >
                {t}
              </button>
            ),
          )}
        </div>

        {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

        {created.length > 0 ? (
          <div className="mt-8 rounded-lg bg-sage/40 p-6">
            <p className="font-serif text-2xl">Готово — в каталоге {created.length} новых блюд</p>
            <p className="mt-2 text-sm text-muted">{created.join(", ")}</p>
            <Link to="/kitchen" className="mt-4 inline-block text-sm text-sage-deep underline">
              Посмотреть в каталоге →
            </Link>
          </div>
        ) : null}

        {recipes.length > 0 ? (
          <div className="mt-8 grid gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">
                Отметьте рецепты для каталога: {chosen.size} из {recipes.length}
              </p>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || chosen.size === 0}
                className="min-h-12 rounded-full bg-sage-deep px-6 font-medium text-cream disabled:opacity-40"
              >
                {saving ? "Сохраняем…" : "Добавить в каталог"}
              </button>
            </div>
            {recipes.map((r, i) => (
              <article
                key={i}
                className={`rounded-lg bg-paper p-5 ${chosen.has(i) ? "" : "opacity-40"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl">{r.title}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {r.timeLabel} · {r.portions} порц. · {r.cuisine} · {r.kcal} ккал (Б{" "}
                      {r.protein} / Ж {r.fat} / У {r.carbs})
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={chosen.has(i)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(i);
                      else next.delete(i);
                      setChosen(next);
                    }}
                    className="size-5"
                    aria-label={`Включить ${r.title}`}
                  />
                </div>
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {r.ingredients.map((ing, j) => (
                    <li key={j} className="rounded-full bg-sage/40 px-3 py-1">
                      {ing.name} {ing.amount}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {r.instructions}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
