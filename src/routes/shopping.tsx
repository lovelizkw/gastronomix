import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getShoppingList, type ShoppingItem } from "@/lib/kitchen-api";

export const Route = createFileRoute("/shopping")({ component: ShoppingPage });

function currentMonday(): string {
  const now = new Date();
  const weekday = now.getDay() || 7;
  now.setDate(now.getDate() - (weekday - 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatAmount(item: ShoppingItem): string {
  return `${item.needed} ${item.unit === "pc" ? "шт" : "г"}`;
}

function ShoppingPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getShoppingList({ data: { weekStart } })
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, weekStart]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of items) {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    }
    return [...map.entries()];
  }, [items]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onCopy() {
    const text = items
      .filter((item) => !checked.has(item.name))
      .map((item) => `${item.name} — ${formatAmount(item)} (${item.category})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
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
            to="/menu"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Меню
          </Link>
          <Link to="/shopping" className="min-h-11 rounded-full bg-cream px-4 py-2 text-ink">
            Покупки
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
              ПОКУПКИ
            </h1>
            <p className="mt-2 text-sm text-muted">
              Что нужно докупить для недельного меню с учётом холодильника.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart(shiftDays(weekStart, -7))}
              className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm"
            >
              ← Прошлая
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(currentMonday())}
              className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm"
            >
              Эта неделя
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(shiftDays(weekStart, 7))}
              className="min-h-11 rounded-full border border-line bg-paper px-4 text-sm"
            >
              Следующая →
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-cream"
              title="Распечатать список или сохранить в PDF"
            >
              Печать / PDF
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Считаем список…</p>
        ) : items.length === 0 ? (
          <div className="mt-8 border border-dashed border-line px-6 py-16 text-center">
            <p className="font-serif text-2xl">Список пуст</p>
            <p className="mt-2 text-sm text-muted">
              Заполните планировщик меню — и список соберётся автоматически
            </p>
            <Link to="/menu" className="mt-4 inline-block text-sm text-sage-deep underline">
              Перейти к планировщику →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCopy}
                className="min-h-12 rounded-full bg-ink px-6 text-sm font-medium text-cream"
              >
                {copied ? "Скопировано!" : "Скопировать список"}
              </button>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="min-h-11 text-sm text-muted underline"
              >
                Сбросить отметки
              </button>
            </div>

            <div className="mt-8 grid gap-6">
              {grouped.map(([category, categoryItems]) => (
                <section key={category}>
                  <h2 className="font-serif text-xl text-sage-deep">{category}</h2>
                  <ul className="mt-2 grid gap-1">
                    {categoryItems.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-center gap-3 border-b border-line/70 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(item.name)}
                          onChange={(e) => {
                            const next = new Set(checked);
                            if (e.target.checked) next.add(item.name);
                            else next.delete(item.name);
                            setChecked(next);
                          }}
                          className="size-4"
                        />
                        <span
                          className={`text-sm ${checked.has(item.name) ? "text-muted line-through" : ""}`}
                        >
                          {item.name}
                        </span>
                        <span className="ml-auto text-sm text-muted">
                          {item.have > 0 ? `${formatAmount(item)} · есть ${item.have} ${item.unit === "pc" ? "шт" : "г"}` : formatAmount(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
