import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getMenu,
  listRecipes,
  removeMenuSlot,
  setMenuSlot,
  MEALS,
  MEAL_LABELS,
  type Meal,
  type MenuSlot,
  type RecipeRow,
} from "@/lib/kitchen-api";

export const Route = createFileRoute("/menu")({ component: MenuPage });

/** Понедельник текущей недели в формате ГГГГ-ММ-ДД. */
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

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_LABELS[(date.getDay() + 6) % 7]} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

function MenuPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [slots, setSlots] = useState<MenuSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState<{ day: string; meal: Meal } | null>(null);
  const [catalog, setCatalog] = useState<RecipeRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getMenu({ data: { weekStart } })
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, weekStart]);

  // Каталог для выбора блюда в ячейку — догружается один раз.
  useEffect(() => {
    if (!userId || catalog.length > 0) return;
    let cancelled = false;
    listRecipes()
      .then((result) => {
        if (!cancelled) setCatalog(result.recipes);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [userId, catalog.length]);

  const dayKcal = useMemo(() => {
    const sums = new Map<string, number>();
    for (const slot of slots) {
      if (slot.recipe) {
        sums.set(slot.day, (sums.get(slot.day) ?? 0) + slot.recipe.kbju.k);
      }
    }
    return sums;
  }, [slots]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (r) => r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
    );
  }, [catalog, search]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onPick(recipeId: number) {
    if (!picker) return;
    await setMenuSlot({ data: { day: picker.day, meal: picker.meal, recipeId } });
    const result = await getMenu({ data: { weekStart } });
    setSlots(result);
    setPicker(null);
  }

  async function onClear(slot: MenuSlot) {
    await removeMenuSlot({ data: { day: slot.day, meal: slot.meal } });
    const result = await getMenu({ data: { weekStart } });
    setSlots(result);
  }

  const days = Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i));

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
          <Link to="/menu" className="min-h-11 rounded-full bg-cream px-4 py-2 text-ink">
            Меню
          </Link>
          <Link
            to="/shopping"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Покупки
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
              МЕНЮ
            </h1>
            <p className="mt-2 text-sm text-muted">
              Соберите неделю: нажмите на ячейку и выберите блюдо. КБЖУ считается по плану.
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
              title="Распечатать план или сохранить в PDF"
            >
              Печать / PDF
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Загружаем план…</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-24 text-xs text-muted" />
                  {MEALS.map((meal) => (
                    <th key={meal} className="text-xs font-medium text-muted">
                      {MEAL_LABELS[meal]}
                    </th>
                  ))}
                  <th className="w-24 text-xs text-muted">Ккал</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day, index) => (
                  <tr key={day}>
                    <th className="text-left text-sm font-medium text-ink">
                      {dayLabel(day)}
                    </th>
                    {MEALS.map((meal) => {
                      const slot = slots.find((s) => s.day === day && s.meal === meal);
                      return (
                        <td key={meal} className="w-1/5">
                          <div className="rounded-md bg-paper p-2">
                            {slot?.recipe ? (
                              <>
                                <Link
                                  to="/recipes/$recipeId"
                                  params={{ recipeId: String(slot.recipe.id) }}
                                  className="block text-xs font-medium hover:underline"
                                >
                                  {slot.recipe.title}
                                </Link>
                                <p className="mt-1 text-[10px] text-muted">
                                  {slot.recipe.kbju.k} ккал · {slot.recipe.minutes} мин
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void onClear(slot)}
                                  className="mt-1 text-[10px] text-muted underline"
                                >
                                  Убрать
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPicker({ day, meal })}
                                className="min-h-14 w-full rounded border border-dashed border-line text-lg text-muted"
                                aria-label="Добавить блюдо"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center text-sm text-muted">
                      {dayKcal.get(day) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {picker ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-5">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-cream p-6">
            <h2 className="font-serif text-2xl">
              {MEAL_LABELS[picker.meal]} · {dayLabel(picker.day)}
            </h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск блюда или ингредиента"
              className="mt-4 min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm"
            />
            <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
              {filteredCatalog.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void onPick(r.id)}
                    className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-paper"
                  >
                    <img src={r.image} alt="" className="size-10 rounded object-cover" />
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="ml-auto text-xs text-muted">{r.kbju.k} ккал</span>
                  </button>
                </li>
              ))}
              {filteredCatalog.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted">Ничего не нашлось</li>
              ) : null}
            </ul>
            <button
              type="button"
              onClick={() => setPicker(null)}
              className="mt-4 min-h-11 w-full rounded-full bg-paper text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
