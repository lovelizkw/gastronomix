import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  cookCustomBowl,
  listProducts,
  productKbju,
  type ProductRow,
} from "@/lib/kitchen-api";

export const Route = createFileRoute("/builder")({ component: BuilderPage });

type Slot = { title: string; hint: string; categories: string[]; grams: number };

const SLOTS: Slot[] = [
  { title: "База", hint: "рис, гречка, макароны", categories: ["Крупы"], grams: 200 },
  { title: "Белок", hint: "курица, рыба, яйца, творог", categories: ["Мясо", "Рыба", "Яйца", "Молочное"], grams: 150 },
  { title: "Овощи", hint: "помидоры, огурцы, перец", categories: ["Овощи", "Фрукты"], grams: 200 },
  { title: "Соус и топпинг", hint: "масло, сыр, зелень", categories: ["Бакалея"], grams: 30 },
];

function BuilderPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [picks, setPicks] = useState<Record<number, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Продукты слота: подходящая категория или «Прочее». */
  function slotProducts(slot: Slot): ProductRow[] {
    return products.filter(
      (p) => slot.categories.includes(p.category) || p.category === "Прочее",
    );
  }

  const chosen = useMemo(
    () =>
      SLOTS.map((slot, i) => {
        const name = picks[i];
        if (!name) return null;
        return { slot, name, grams: slot.grams };
      }).filter(Boolean) as { slot: Slot; name: string; grams: number }[],
    [picks],
  );

  const kbju = useMemo(() => {
    const total = { k: 0, b: 0, j: 0, u: 0 };
    for (const item of chosen) {
      const per100 = productKbju(item.name);
      total.k += (per100.k * item.grams) / 100;
      total.b += (per100.b * item.grams) / 100;
      total.j += (per100.j * item.grams) / 100;
      total.u += (per100.u * item.grams) / 100;
    }
    return {
      k: Math.round(total.k),
      b: Math.round(total.b),
      j: Math.round(total.j),
      u: Math.round(total.u),
    };
  }, [chosen]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onCook() {
    if (chosen.length === 0) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await cookCustomBowl({
        data: { items: chosen.map((c) => ({ name: c.name, grams: c.grams })) },
      });
      setMessage(
        [
          `Итог ≈ ${result.kcal} ккал.`,
          result.used.length ? `Списано: ${result.used.join(", ")}.` : "",
          result.missing.length ? `Не нашлось: ${result.missing.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      const rows = await listProducts();
      setProducts(rows);
    } catch {
      setError("Не получилось собрать боул. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
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
        <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
          КОНСТРУКТОР
        </h1>
        <p className="mt-2 text-sm text-muted">
          Соберите боул, вок или салат без рецепта — из того, что уже есть дома.
          КБЖУ считается сразу, а при готовке продукты спишутся из холодильника.
        </p>

        <div className="mt-8 grid gap-5">
          {SLOTS.map((slot, i) => {
            const options = slotProducts(slot);
            return (
              <section key={slot.title} className="rounded-lg bg-paper p-5">
                <h2 className="font-serif text-xl">
                  {slot.title} <span className="text-sm text-muted">· {slot.grams} г</span>
                </h2>
                <p className="text-xs text-muted">{slot.hint}</p>
                {options.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    Подходящих продуктов нет — добавьте их в холодильник.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {options.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={picks[i] === p.name}
                        onClick={() =>
                          setPicks((prev) => ({
                            ...prev,
                            [i]: prev[i] === p.name ? null : p.name,
                          }))
                        }
                        className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors active:scale-95 ${
                          picks[i] === p.name
                            ? "bg-sage-deep text-cream"
                            : "border border-line bg-cream text-ink"
                        }`}
                      >
                        {picks[i] === p.name ? `✓ ${p.name}` : p.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg bg-ink p-6 text-cream">
          <p className="text-xs uppercase tracking-wide text-cream/60">Ваш боул</p>
          {chosen.length === 0 ? (
            <p className="mt-2 text-sm text-cream/70">Выберите продукты выше — итог появится здесь.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-cream/80">
                {chosen.map((c) => `${c.name} ${c.grams} г`).join(" + ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
                <span className="rounded-full bg-cream/15 px-4 py-2">{kbju.k} ккал</span>
                <span className="rounded-full bg-cream/15 px-4 py-2">Б {kbju.b} г</span>
                <span className="rounded-full bg-cream/15 px-4 py-2">Ж {kbju.j} г</span>
                <span className="rounded-full bg-cream/15 px-4 py-2">У {kbju.u} г</span>
              </div>
              <button
                type="button"
                onClick={onCook}
                disabled={busy}
                className="mt-4 min-h-12 rounded-full bg-sage-deep px-6 font-medium text-cream disabled:opacity-40"
              >
                {busy ? "Списываем…" : "Приготовить и списать из холодильника"}
              </button>
            </>
          )}
          {message ? <p className="mt-3 text-sm text-cream/80">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-blush">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
