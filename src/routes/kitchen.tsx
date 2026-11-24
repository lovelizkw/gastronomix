import { createFileRoute, Link } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { KitchenUser } from "@/components/site-nav";
import {
  addProduct,
  addProductsBulk,
  createRecipe,
  deleteRecipe,
  getMenu,
  importRecipeFromUrl,
  listProducts,
  listRecipes,
  removeProduct,
  toggleFavorite,
  updateRecipe,
  type IngredientItem,
  type MenuSlot,
  type ProductRow,
  type RecipeFilters,
  type RecipeRow,
} from "@/lib/kitchen-api";
import { importRecipeWithLlm } from "@/lib/llm-api";
import { matchInfo, matchRecipes } from "@/lib/recipes";
import { ChefChat } from "@/components/chef-chat";

export const Route = createFileRoute("/kitchen")({ component: KitchenPage });

/** Значения формы рецепта, которые отправляются на сервер. */
export type RecipeFormValues = {
  title: string;
  timeLabel: string;
  portions: number;
  ingredients: IngredientItem[];
  instructions: string;
  image: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

/** Подсказки категории «умной строки» по названию продукта. */
const CATEGORY_HINTS: [RegExp, string][] = [
  [/молок|сыр|сметан|творог|кефир|йогурт|ряженк/, "Молочное"],
  [/куриц|индейк|мясо|фарш|свинин|говядин|бекон|ветчин|печен|колбас/, "Мясо"],
  [/рыба|тунец|лосось|креветк|икра/, "Рыба"],
  [/помидор|томат|огур|картоф|морков|лук|капуст|перец|кабач|свекл|чеснок|баклаж/, "Овощи"],
  [/яблок|лимон|банан|апельсин|груш|виноград/, "Фрукты"],
  [/хлеб|булк|сухарик|лаваш|круассан/, "Хлеб"],
  [/мука|сахар|соль|специ|масло|сода|дрожж|корица|соус|горчица/, "Бакалея"],
  [/яйц/, "Яйца"],
  [/гречк|рис|макарон|спагетти|лапша|овсян|пшен|перлов|чечевиц|горох|манк/, "Крупы"],
];

function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(lower)) return category;
  }
  return "";
}

/** Дата через N дней в формате ГГГГ-ММ-ДД для поля срока годности. */
function dateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Превращает выбранный файл в компактный data-URL: уменьшает длинную сторону
 * до maxSize и перекодирует в JPEG, чтобы фото recipes.image не раздувало базу.
 */
async function fileToCompressedDataUrl(
  file: File,
  maxSize = 1000,
  quality = 0.75,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен в этом браузере");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Значения формы из строки рецепта (для режима редактирования). */
function recipeToFormValues(r: RecipeRow): RecipeFormValues {
  return {
    title: r.title,
    timeLabel: r.timeLabel,
    portions: r.portions,
    ingredients: r.ingredients.map((i) => ({ ...i })),
    instructions: r.instructions,
    image: r.image.startsWith("data:") ? r.image : "",
    kcal: r.kbju.k,
    protein: r.kbju.b,
    fat: r.kbju.j,
    carbs: r.kbju.u,
  };
}

function KitchenPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [tab, setTab] = useState<"fridge" | "recipes" | "create">("fridge");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [hidden, setHidden] = useState(0);
  const [filters, setFilters] = useState<RecipeFilters>({});
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editing, setEditing] = useState<RecipeRow | null>(null);
  const [menu, setMenu] = useState<MenuSlot[]>([]);

  // Зависимость — строковый id, а не объект user: useCurrentUserState
  // возвращает новый объект на каждый рендер, и эффект зацикливался.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listProducts()
      .then((p) => {
        if (!cancelled) setProducts(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const monday = new Date();
    const weekday = monday.getDay() || 7;
    monday.setDate(monday.getDate() - (weekday - 1));
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    getMenu({ data: { weekStart: iso } })
      .then((slots) => {
        if (!cancelled) setMenu(slots);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Рецепты перезапрашиваются на сервере при изменении фильтров (с небольшой
  // задержкой для поисковой строки, чтобы не долбить сервер на каждый символ).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setRecipesLoading(true);
    const timer = setTimeout(() => {
      listRecipes({ data: filters })
        .then((result) => {
          if (!cancelled) {
            setRecipes(result.recipes);
            setHidden(result.hidden);
          }
        })
        .finally(() => {
          if (!cancelled) setRecipesLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, filters]);

  const productNames = useMemo(() => products.map((p) => p.name), [products]);
  const visibleRecipes = useMemo(
    () => matchRecipes(recipes, productNames),
    [recipes, productNames],
  );

  // Сводка КБЖУ за сегодня из планировщика меню.
  const todayKcal = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return menu
      .filter((slot) => slot.day === today && slot.recipe)
      .reduce((sum, slot) => sum + (slot.recipe?.kbju.k ?? 0), 0);
  }, [menu]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onAddProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const row = await addProduct({
      data: {
        name: String(data.get("name") ?? ""),
        category: String(data.get("category") ?? ""),
        qty: String(data.get("qty") ?? ""),
        expiresAt: String(data.get("expiresAt") ?? ""),
      },
    });
    if (row) setProducts((prev) => [row, ...prev]);
    setOpen(false);
    form.reset();
  }

  /** Пресет «Базовый набор» — стандартная закупка одним нажатием. */
  async function onAddPreset() {
    const preset = [
      { name: "хлеб", category: "Хлеб", qty: "1 буханка" },
      { name: "яйца", category: "Яйца", qty: "10 шт" },
      { name: "молоко", category: "Молочное", qty: "1 л" },
      { name: "масло сливочное", category: "Молочное", qty: "180 г" },
      { name: "куриное филе", category: "Мясо", qty: "500 г" },
    ];
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expiresAt = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const rows = await addProductsBulk({
      data: { items: preset.map((p) => ({ ...p, expiresAt })) },
    });
    setProducts((prev) => [...rows, ...prev]);
    setOpen(false);
  }

  /** Разбирает вставленный список: каждая строка — продукт, число — количество. */
  function parsePastedList(text: string): { name: string; category: string; qty: string }[] {
    const result: { name: string; category: string; qty: string }[] = [];
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/^[-*•–\s]+\s*/, "").replace(/^[0-9]+[.)]\s*/, "");
      if (!line) continue;
      const match = line.match(/^(.*?)\s*[-–—:]\s*(\d+[.,]?\d*\s*(?:г|гр|мл|шт|кг|л|упак)[^\s]*)$/i);
      let name = line;
      let qty = "";
      if (match) {
        name = match[1];
        qty = match[2];
      } else {
        const qtyMatch = line.match(/^(.*?)\s+(\d+[.,]?\d*\s*(?:г|гр|мл|шт|кг|л|упак)[^\s]*)$/i);
        if (qtyMatch) {
          name = qtyMatch[1];
          qty = qtyMatch[2];
        }
      }
      name = name.trim().replace(/[;,.]+$/, "");
      if (!name) continue;
      result.push({ name: name.charAt(0).toUpperCase() + name.slice(1), category: guessCategory(name), qty });
    }
    return result.slice(0, 50);
  }

  async function onPasteSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get("list") ?? "");
    const items = parsePastedList(text).map((item) => ({
      ...item,
      expiresAt: dateInDays(7),
    }));
    if (items.length === 0) return;
    const rows = await addProductsBulk({ data: { items } });
    setProducts((prev) => [...rows, ...prev]);
    setPasteOpen(false);
    form.reset();
  }

  async function onSubmitRecipe(values: RecipeFormValues) {
    if (editing) {
      const row = await updateRecipe({ data: { id: editing.id, ...values } });
      if (row) {
        setRecipes((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      }
      setEditing(null);
      setTab("recipes");
      return;
    }
    const row = await createRecipe({ data: values });
    if (row) {
      setRecipes((prev) => [row, ...prev]);
      setTab("recipes");
    }
  }

  async function onToggleFavorite(id: number) {
    const result = await toggleFavorite({ data: { id } });
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, favorite: result.favorite } : r)),
    );
  }

  return (
    <main className="min-h-svh bg-cream">
      <header className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
        <Link to="/" className="font-display text-sm tracking-[0.28em] uppercase">
          Gastronomix
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/kitchen" className="min-h-11 rounded-full bg-cream px-4 py-2 text-ink">
            Кухня
          </Link>
          <Link
            to="/menu"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Меню
          </Link>
          <Link
            to="/shopping"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Покупки
          </Link>
          <Link
            to="/builder"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Конструктор
          </Link>
          <Link
            to="/grow"
            className="min-h-11 rounded-full border border-blush/60 bg-blush/20 px-4 py-2 text-cream"
            title="Расширить каталог с помощью ИИ"
          >
            ИИ-каталог
          </Link>
          <Link
            to="/profile"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Профиль
          </Link>
          <KitchenUser />
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8 flex flex-wrap gap-2">
          {(
            [
              ["fridge", "Холодильник"],
              ["recipes", "Рецепты"],
              ["create", "Свой рецепт"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id !== "create") setEditing(null);
                setTab(id);
              }}
              className={`min-h-11 rounded-full px-5 ${tab === id ? "bg-ink text-cream" : "bg-paper text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted">Загружаем данные…</p>
        ) : tab === "fridge" ? (
          <Fridge
            products={products}
            todayKcal={todayKcal}
            todayRecipe={visibleRecipes[0] ?? null}
            onOpen={() => setOpen(true)}
            onOpenPaste={() => setPasteOpen(true)}
            onAddPreset={onAddPreset}
            onRescue={(productName) => {
              setFilters({ q: productName });
              setTab("recipes");
            }}
            onRemove={async (id) => {
              await removeProduct({ data: { id } });
              setProducts((prev) => prev.filter((p) => p.id !== id));
            }}
          />
        ) : tab === "recipes" ? (
          <RecipeList
            recipes={visibleRecipes}
            filters={filters}
            loading={recipesLoading}
            onFiltersChange={setFilters}
            onToggleFavorite={onToggleFavorite}
            onEdit={(recipe) => {
              setEditing(recipe);
              setTab("create");
            }}
            onDelete={async (id) => {
              const recipe = recipes.find((r) => r.id === id);
              if (!window.confirm(`Удалить рецепт «${recipe?.title ?? ""}»?`)) return;
              await deleteRecipe({ data: { id } });
              setRecipes((prev) => prev.filter((r) => r.id !== id));
            }}
          />
        ) : (
          <RecipeForm
            key={editing ? `edit-${editing.id}` : "new"}
            initial={editing ? recipeToFormValues(editing) : null}
            onSubmit={onSubmitRecipe}
            onCancel={
              editing
                ? () => {
                    setEditing(null);
                    setTab("recipes");
                  }
                : undefined
            }
          />
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-5">
          <form
            onSubmit={onAddProduct}
            className="w-full max-w-md rounded-lg bg-cream p-6 md:p-8"
          >
            <h2 className="font-serif text-3xl">Новый продукт</h2>
            <label className="mt-5 block text-sm">
              Название
              <input
                name="name"
                required
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
                placeholder="Помидор"
              />
            </label>
            <label className="mt-4 block text-sm">
              Категория
              <input
                name="category"
                list="product-categories"
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
                placeholder="Овощи"
              />
            </label>
            <datalist id="product-categories">
              {["Овощи", "Фрукты", "Молочное", "Мясо", "Рыба", "Яйца", "Хлеб", "Крупы", "Бакалея"].map(
                (c) => (
                  <option key={c} value={c} />
                ),
              )}
            </datalist>
            <label className="mt-4 block text-sm">
              Количество
              <input
                name="qty"
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
                placeholder="3 шт"
              />
            </label>
            <label className="mt-4 block text-sm">
              Срок годности
              <input
                type="date"
                name="expiresAt"
                defaultValue={dateInDays(7)}
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
              />
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-12 flex-1 rounded-full bg-paper"
              >
                Отмена
              </button>
              <button type="submit" className="min-h-12 flex-1 rounded-full bg-ink text-cream">
                Добавить
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pasteOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-5">
          <form
            onSubmit={onPasteSubmit}
            className="w-full max-w-md rounded-lg bg-cream p-6 md:p-8"
          >
            <h2 className="font-serif text-3xl">Вставить список</h2>
            <p className="mt-2 text-sm text-muted">
              Скопируйте продукты из заметок или чека — по строке на продукт.
              Число рядом с названием станет количеством.
            </p>
            <textarea
              name="list"
              rows={8}
              className="mt-4 w-full rounded-md border border-line bg-paper p-3 text-sm"
              placeholder={"Молоко 1 л\nЯйца 10 шт\nКурица 500 г"}
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="min-h-12 flex-1 rounded-full bg-paper"
              >
                Отмена
              </button>
              <button type="submit" className="min-h-12 flex-1 rounded-full bg-ink text-cream">
                Добавить всё
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <ChefChat />
    </main>
  );
}

/** Сколько дней осталось до конца срока годности (или null, если не указан). */
function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const [y, m, d] = expiresAt.split("-").map(Number);
  if (!y || !m || !d) return null;
  const expiry = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Шкала жизни продукта: какая часть срока годности осталась.
 * Прогресс считается от даты добавления (created_at) до expires_at.
 * Возвращает долю 0..1 (1 — только что куплен, 0 — срок вышел).
 */
function shelfLifeLeft(product: ProductRow): number | null {
  if (!product.expiresAt) return null;
  const days = daysLeft(product.expiresAt);
  if (days === null) return null;
  if (!product.createdAt) return days <= 0 ? 0 : 1;
  const [cy, cm, cd] = product.createdAt.split("-").map(Number);
  const [ey, em, ed] = product.expiresAt.split("-").map(Number);
  const created = new Date(cy, cm - 1, cd).getTime();
  const expiry = new Date(ey, em - 1, ed).getTime();
  const now = Date.now();
  const total = expiry - created;
  if (!Number.isFinite(total) || total <= 0) return days <= 0 ? 0 : 1;
  return Math.min(1, Math.max(0, (expiry - now) / total));
}

/** Цвет светофора: доля оставшегося срока → зелёный / жёлтый / красный. */
function freshnessColor(product: ProductRow): { bar: string; label: string } | null {
  const left = shelfLifeLeft(product);
  if (left === null) return null;
  if (left <= 0.2) return { bar: "bg-blush-deep", label: "Используйте срочно" };
  if (left <= 0.5) return { bar: "bg-blush", label: "Скоро испортится" };
  return { bar: "bg-sage-deep", label: "Свежий" };
}

function freshnessBadge(days: number | null): { label: string; className: string } | null {
  if (days === null) return null;
  if (days < 0) return { label: "Просрочен", className: "bg-blush text-ink" };
  if (days <= 2) return { label: "Срочно: сегодня-завтра", className: "bg-blush text-ink" };
  if (days <= 6) return { label: "Скоро испортится", className: "bg-blush/60 text-ink" };
  return null;
}

function Fridge({
  products,
  todayKcal,
  todayRecipe,
  onOpen,
  onOpenPaste,
  onAddPreset,
  onRescue,
  onRemove,
}: {
  products: ProductRow[];
  todayKcal: number;
  todayRecipe: RecipeRow | null;
  onOpen: () => void;
  onOpenPaste: () => void;
  onAddPreset: () => void;
  onRescue: (productName: string) => void;
  onRemove: (id: number) => void;
}) {
  const rescue = products
    .map((p) => ({ product: p, days: daysLeft(p.expiresAt) }))
    .filter((x) => x.days !== null && x.days <= 1)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    .slice(0, 3);
  const soon = products
    .map((p) => ({ product: p, days: daysLeft(p.expiresAt) }))
    .filter((x) => x.days !== null && x.days <= 6)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  return (
    <section>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
            ХОЛОДИЛЬНИК
          </h1>
          <p className="mt-2 text-sm text-muted">Что есть дома и что использовать первым.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="min-h-12 rounded-full bg-blush px-6 font-medium text-ink"
          >
            Добавить продукт
          </button>
          <button
            type="button"
            onClick={onAddPreset}
            className="min-h-12 rounded-full border border-line bg-paper px-6 font-medium text-ink"
            title="Хлеб, яйца, молоко, масло, курица"
          >
            Базовый набор
          </button>
          <button
            type="button"
            onClick={onOpenPaste}
            className="min-h-12 rounded-full border border-line bg-paper px-6 font-medium text-ink"
          >
            Вставить список
          </button>
        </div>
      </div>

      {/* Дашборд: спаси меня сегодня, блюдо дня, КБЖУ за день */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-blush/40 p-5">
          <p className="text-xs font-medium tracking-wide uppercase text-ink">Спаси меня сегодня</p>
          {rescue.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              За ближайшие сутки ничего не испортится — всё под контролем
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rescue.map(({ product, days }) => (
                <li key={product.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-muted">
                      {days! < 0 ? "просрочен" : days === 0 ? "истекает сегодня" : "истекает завтра"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRescue(product.name)}
                    className="mt-1 min-h-9 rounded-full bg-ink px-4 text-xs font-medium text-cream"
                  >
                    Приготовить из этого
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg bg-paper p-5">
          <p className="text-xs tracking-wide uppercase text-muted">Блюдо на сегодня</p>
          {todayRecipe ? (
            <Link
              to="/recipes/$recipeId"
              params={{ recipeId: String(todayRecipe.id) }}
              className="mt-3 block font-serif text-lg hover:underline"
            >
              {todayRecipe.title}
            </Link>
          ) : (
            <p className="mt-3 text-sm text-muted">Добавьте продукты — подберём блюдо</p>
          )}
        </div>
        <div className="rounded-lg bg-paper p-5">
          <p className="text-xs tracking-wide uppercase text-muted">КБЖУ по меню на сегодня</p>
          <p className="mt-3 font-display text-4xl font-light text-sage-deep">
            {todayKcal}
            <span className="text-lg text-muted"> ккал</span>
          </p>
          <Link to="/menu" className="mt-2 inline-block text-sm text-muted underline">
            Планировщик меню →
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg bg-paper px-6 py-16 text-center shadow-sm">
          <p className="font-serif text-2xl">Пока пусто</p>
          <p className="mt-2 text-sm text-muted">
            Добавьте продукты вручную, вставьте список или начните с базового набора
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const badge = freshnessBadge(daysLeft(p.expiresAt));
            const color = freshnessColor(p);
            const left = shelfLifeLeft(p);
            return (
              <article key={p.id} className="gx-card-hover rounded-xl bg-paper p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex size-11 items-center justify-center rounded-xl text-lg ${plateTint(p.category)}`}>
                      {categoryIcon(p.category)}
                    </span>
                    <div>
                      <p className="font-serif text-xl">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.category}
                        {p.qty ? ` · ${p.qty}` : ""}
                      </p>
                    </div>
                  </div>
                  {p.expiresAt ? (
                    <span className="text-[10px] text-muted">{p.expiresAt.slice(5)}</span>
                  ) : null}
                </div>
                {badge ? (
                  <span
                    className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ) : null}
                {/* Светофор свежести: зелёный → жёлтый → красный */}
                {color && left !== null ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full transition-all ${color.bar}`}
                        style={{ width: `${Math.max(3, Math.round(left * 100))}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="mt-3 min-h-8 text-xs text-muted underline"
                >
                  Удалить
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Значок-иконка категории (текстовый символ, без эмодзи). */
function categoryIcon(category: string): string {
  const map: Record<string, string> = {
    "Молочное": "●",
    "Мясо": "▲",
    "Рыба": "◆",
    "Овощи": "❋",
    "Фрукты": "❍",
    "Хлеб": "▬",
    "Яйца": "◯",
    "Крупы": "⬡",
    "Бакалея": "◇",
  };
  return map[category] ?? "•";
}

/** Мягкая подложка иконки по категории. */
function plateTint(category: string): string {
  const map: Record<string, string> = {
    "Молочное": "bg-lilac/40",
    "Мясо": "bg-blush/50",
    "Рыба": "bg-lilac/60",
    "Овощи": "bg-sage/60",
    "Фрукты": "bg-sage",
    "Хлеб": "bg-blush/30",
    "Яйца": "bg-blush/40",
    "Крупы": "bg-sage-deep/30",
    "Бакалея": "bg-lilac/30",
  };
  return map[category] ?? "bg-line";
}

/** Категории витрины (референс 2) и привязка рецептов по ключевым словам. */
const CATEGORIES: { key: string; label: string; image: string; keywords: string[] }[] = [
  {
    key: "breakfast",
    label: "Завтрак",
    image: "/images/recipes/blini.jpg",
    keywords: ["блин", "омлет", "яичниц", "сырник", "овсян", "запекан", "тост", "панкейк", "гранола", "каша", "французские тосты", "английский завтрак", "онигири"],
  },
  {
    key: "lunch",
    label: "Обед",
    image: "/images/recipes/borscht.jpg",
    keywords: ["суп", "борщ", "харчо", "гаспачо", "чечевич", "оливье", "шуба", "винегрет", "нисуаз", "бульон", "том-ям", "хумус", "табуле", "салат"],
  },
  {
    key: "dinner",
    label: "Ужин",
    image: "/images/recipes/shashlik.jpg",
    keywords: ["шашлык", "люля", "манты", "долма", "лагман", "карри", "паста", "ризотто", "плов", "тефтел", "фахитас", "буррито", "тако", "чили", "мусака", "гуляш", "бефстроганов", "чахохбили", "хачапури", "пицца", "наггетс", "крылышки", "котлета по-киевски", "макароны", "курица с рисом", "курица с грибами"],
  },
  {
    key: "healthy",
    label: "Здоровая еда",
    image: "/images/recipes/quinoa-salad.jpg",
    keywords: ["киноа", "табуле", "хумус", "гречк", "винегрет", "овощное", "тыквенн", "капрезе", "паста с курицей и брокколи", "оливье"],
  },
  {
    key: "snacks",
    label: "Закуски",
    image: "/images/recipes/nachos.jpg",
    keywords: ["брускетта", "начос", "сэндвич", "темпура", "фалафель", "крылышк", "наггетс", "онигири", "сухарик"],
  },
  {
    key: "desserts",
    label: "Десерты",
    image: "/images/recipes/tiramisu.jpg",
    keywords: ["тирамису", "чизкейк", "панна", "брауни", "маффин", "печенье", "яблоки", "крем-брюле", "шарлотка", "пудинг", "блины на молоке"],
  },
];

function recipeCategory(title: string): { key: string; label: string } {
  const lower = title.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) return { key: cat.key, label: cat.label };
  }
  return { key: "dinner", label: "Ужин" };
}

function RecipeList({
  recipes,
  filters,
  loading,
  onFiltersChange,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  recipes: RecipeRow[];
  filters: RecipeFilters;
  loading: boolean;
  onFiltersChange: (filters: RecipeFilters) => void;
  onToggleFavorite: (id: number) => void;
  onEdit: (recipe: RecipeRow) => void;
  onDelete: (id: number) => void;
}) {
  function update(patch: RecipeFilters) {
    const next: RecipeFilters = { ...filters, ...patch };
    for (const key of Object.keys(next) as (keyof RecipeFilters)[]) {
      const value = next[key];
      if (value === undefined || value === "" || value === false) delete next[key];
    }
    onFiltersChange(next);
  }

  const hasFilters = Object.keys(filters).length > 0;
  // Категории из референса 2: плитки с фото фильтруют выдачу.
  const [category, setCategory] = useState<string | null>(null);
  const categoryRecipes = useMemo(
    () => (category ? recipes.filter((r) => recipeCategory(r.title).key === category) : recipes),
    [recipes, category],
  );

  return (
    <section>
      {/* Баннер с поиском (референс 2) */}
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src="/images/recipes/tiramisu.jpg"
          alt=""
          className="h-64 w-full object-cover md:h-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
        <div className="absolute left-6 top-6 md:left-8 md:top-8">
          <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink">
            Дома теплее
          </span>
          <h1 className="mt-3 max-w-md font-display text-4xl font-light leading-[0.9] tracking-tight text-cream md:text-6xl">
            ВРЕМЯ СДЕЛАТЬ ПЕРЕРЫВ НА ВКУСНОЕ
          </h1>
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="absolute inset-x-5 bottom-5 flex items-center gap-2 rounded-full bg-cream p-2 shadow-lg md:inset-x-8"
        >
          <span className="pl-4 text-muted">⌕</span>
          <input
            type="search"
            value={filters.q ?? ""}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Что вы хотите приготовить сегодня?"
            className="min-h-11 flex-1 bg-transparent px-2 text-sm text-ink outline-none"
          />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-full bg-sage-deep px-6 text-sm font-medium text-cream"
          >
            Найти
          </button>
        </form>
      </div>

      {/* Мягкие фильтры под баннером */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={filters.maxKcal ?? ""}
          onChange={(e) => update({ maxKcal: e.target.value ? Number(e.target.value) : undefined })}
          className="min-h-10 rounded-full border border-line bg-paper px-4 text-sm text-ink"
        >
          <option value="">Любая калорийность</option>
          <option value="200">до 200 ккал</option>
          <option value="300">до 300 ккал</option>
          <option value="400">до 400 ккал</option>
          <option value="500">до 500 ккал</option>
        </select>
        <select
          value={filters.maxMinutes ?? ""}
          onChange={(e) =>
            update({ maxMinutes: e.target.value ? Number(e.target.value) : undefined })
          }
          className="min-h-10 rounded-full border border-line bg-paper px-4 text-sm text-ink"
        >
          <option value="">Любое время</option>
          <option value="15">до 15 мин</option>
          <option value="30">до 30 мин</option>
          <option value="45">до 45 мин</option>
          <option value="60">до 60 мин</option>
        </select>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.favoritesOnly)}
            onChange={(e) => update({ favoritesOnly: e.target.checked })}
            className="size-4"
          />
          Только избранное
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => onFiltersChange({})}
            className="min-h-10 text-sm text-muted underline"
          >
            Сбросить
          </button>
        ) : null}
      </div>

      {/* Плитки категорий (референс 2) */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategory(category === cat.key ? null : cat.key)}
            className={`relative overflow-hidden rounded-xl transition-shadow ${
              category === cat.key ? "ring-2 ring-sage-deep" : "hover:shadow-lg"
            }`}
          >
            <img src={cat.image} alt="" className="h-32 w-full object-cover md:h-36" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
            <span className="absolute bottom-3 left-4 font-medium text-cream">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Все рецепты — чистые карточки (референс 3) */}
      <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6">
        {loading ? (
          <p className="col-span-full py-10 text-sm text-muted">Подбираем рецепты…</p>
        ) : categoryRecipes.length === 0 ? (
          <div className="col-span-full rounded-lg bg-paper px-6 py-16 text-center shadow-sm">
            <p className="font-serif text-2xl">Ничего не нашлось</p>
            <p className="mt-2 text-sm text-muted">
              Попробуйте изменить запрос или сбросить фильтры
            </p>
          </div>
        ) : (
          categoryRecipes.map((r) => {
            const cat = recipeCategory(r.title);
            return (
              <article key={r.id} className="gx-card-hover overflow-hidden rounded-xl bg-paper shadow-sm">
                <div className="relative">
                  {r.image ? (
                    <Link to="/recipes/$recipeId" params={{ recipeId: String(r.id) }}>
                      <img src={r.image} alt={r.title} className="h-44 w-full object-cover" />
                    </Link>
                  ) : (
                    <Link
                      to="/recipes/$recipeId"
                      params={{ recipeId: String(r.id) }}
                      className="flex h-44 w-full flex-col items-center justify-center gap-2 bg-lilac/20 text-muted"
                    >
                      <span className="font-serif text-lg text-ink">Фото пока нет</span>
                      {r.mine ? (
                        <span className="text-xs">Добавьте своё — через «Изменить»</span>
                      ) : null}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(r.id)}
                    aria-label={r.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                    aria-pressed={r.favorite}
                    className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-lg leading-none shadow ${
                      r.favorite ? "bg-blush text-ink" : "bg-cream/90 text-muted"
                    }`}
                  >
                    {r.favorite ? "♥" : "♡"}
                  </button>
                  <span className="absolute left-3 top-3 flex gap-1">
                    {r.createdByAi ? (
                      <span className="rounded-full bg-lilac px-2 py-0.5 text-[10px] font-medium text-ink">
                        ИИ
                      </span>
                    ) : null}
                    <span className="rounded-full bg-cream/90 px-2 py-0.5 text-[10px] font-medium text-ink">
                      {r.mine ? "Ваш рецепт" : "Каталог"}
                    </span>
                  </span>
                </div>
                <div className="p-4">
                  <Link
                    to="/recipes/$recipeId"
                    params={{ recipeId: String(r.id) }}
                    className="font-medium leading-snug hover:underline"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-2 text-xs text-muted">
                    {r.timeLabel} · {r.portions} порц. · {r.ingredients.length} ингредиент
                    {r.ingredients.length % 10 === 1 && r.ingredients.length % 100 !== 11 ? "" : "ов"}
                  </p>
                  <p className="mt-2 text-xs font-medium text-sage-deep">{r.kbju.k} ккал</p>
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span>{cat.label}</span>
                    {r.cuisine ? <span>· {r.cuisine}</span> : null}
                  </p>
                  {r.mine ? (
                    <p className="mt-3 flex gap-3 text-xs">
                      <button type="button" onClick={() => onEdit(r)} className="text-muted underline">
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        className="text-muted underline"
                      >
                        Удалить
                      </button>
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function RecipeForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: RecipeFormValues | null;
  onSubmit: (values: RecipeFormValues) => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(initial);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNote, setImportNote] = useState("");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [timeLabel, setTimeLabel] = useState(initial?.timeLabel ?? "");
  const [portions, setPortions] = useState(initial?.portions ?? 2);
  const [ingredients, setIngredients] = useState<IngredientItem[]>(
    initial?.ingredients.length ? initial.ingredients.map((i) => ({ ...i })) : [{ name: "", amount: "" }],
  );
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [photo, setPhoto] = useState(initial?.image ?? "");
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [kcal, setKcal] = useState(initial?.kcal ?? 0);
  const [protein, setProtein] = useState(initial?.protein ?? 0);
  const [fat, setFat] = useState(initial?.fat ?? 0);
  const [carbs, setCarbs] = useState(initial?.carbs ?? 0);

  const cleaned = ingredients
    .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() }))
    .filter((i) => i.name.length > 0);
  const valid = title.trim().length >= 2 && cleaned.length > 0 && !photoBusy;

  async function onImportUrl(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImportError("");
    setImportBusy(true);
    try {
      let parsed: { title: string; ingredients: { name: string; amount: string }[]; instructions: string } | null =
        null;
      let viaLlm = false;
      try {
        parsed = await importRecipeFromUrl({ data: { url: importUrl.trim() } });
      } catch {
        parsed = null;
      }
      if (!parsed) {
        // На сайте нет разметки schema.org (или он недоступен) — просим LLM.
        parsed = await importRecipeWithLlm({ data: { url: importUrl.trim() } });
        viaLlm = true;
      }
      if (!parsed) {
        setImportError("Не нашли рецепт на странице. Попробуйте другой адрес.");
        return;
      }
      setTitle(parsed.title);
      setIngredients(
        parsed.ingredients.length
          ? parsed.ingredients.map((i) => ({ name: i.name, amount: i.amount }))
          : [{ name: "", amount: "" }],
      );
      setInstructions(parsed.instructions);
      setImportUrl("");
      setImportError("");
      if (viaLlm) {
        setImportNote("Рецепт распознан шеф-ИИ по тексту страницы — проверьте и поправьте детали.");
      }
    } catch (err) {
      setImportError(String(err instanceof Error ? err.message : err).slice(0, 160));
    } finally {
      setImportBusy(false);
    }
  }

  async function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Можно выбрать только изображение");
      return;
    }
    setPhotoError("");
    setPhotoBusy(true);
    try {
      setPhoto(await fileToCompressedDataUrl(file));
    } catch {
      setPhotoError("Не удалось обработать изображение");
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      timeLabel: timeLabel.trim() || "30 мин",
      portions,
      ingredients: cleaned,
      instructions: instructions.trim(),
      image: photo,
      kcal,
      protein,
      fat,
      carbs,
    });
    setTitle("");
    setTimeLabel("");
    setPortions(2);
    setIngredients([{ name: "", amount: "" }]);
    setInstructions("");
    setPhoto("");
    setPhotoError("");
    setKcal(0);
    setProtein(0);
    setFat(0);
    setCarbs(0);
  }

  return (
    <section>
      <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
        {isEdit ? "ПРАВКА РЕЦЕПТА" : "СВОЙ РЕЦЕПТ"}
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        {isEdit
          ? "Обновите описание блюда — изменения сразу появятся в каталоге"
          : "Опишите блюдо, добавьте фото и пищевую ценность — рецепт появится в вашей коллекции"}
      </p>
      {!isEdit ? (
        <form onSubmit={onImportUrl} className="mb-6 max-w-xl rounded-lg bg-paper p-4">
          <p className="text-sm font-medium">Импорт по ссылке</p>
          <p className="mt-1 text-xs text-muted">
            Вставьте адрес рецепта с любого кулинарного сайта — ингредиенты и шаги подтянутся
            в форму автоматически.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://сайт.ru/рецепт/"
              className="min-h-11 min-w-56 flex-1 rounded-md border border-line bg-cream px-3 text-sm"
            />
            <button
              type="submit"
              disabled={importBusy || importUrl.trim().length === 0}
              className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-cream disabled:opacity-40"
            >
              {importBusy ? "Читаем…" : "Импортировать"}
            </button>
          </div>
          {importError ? <p className="mt-2 text-xs text-red-700">{importError}</p> : null}
          {importNote ? (
            <p className="mt-2 rounded-md bg-lilac/30 p-2 text-xs text-ink">{importNote}</p>
          ) : null}
        </form>
      ) : null}
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <label className="block text-sm">
          Название
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
            placeholder="Паста с томатами"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Время
            <input
              value={timeLabel}
              onChange={(e) => setTimeLabel(e.target.value)}
              placeholder="30 мин"
              className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
            />
          </label>
          <label className="block text-sm">
            Порций
            <input
              type="number"
              min={1}
              max={20}
              value={portions}
              onChange={(e) => setPortions(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
            />
          </label>
        </div>

        <div className="text-sm">
          <p className="mb-2">Фото блюда</p>
          <div className="flex items-center gap-4">
            {photo ? (
              <img
                src={photo}
                alt="Превью фото"
                className="h-24 w-24 rounded-md border border-line object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-line text-xs text-muted">
                нет фото
              </div>
            )}
            <div>
              <label className="inline-block min-h-10 cursor-pointer rounded-full bg-paper px-5 py-2 text-sm">
                {photoBusy ? "Обработка…" : photo ? "Заменить фото" : "Выбрать фото"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onPhotoChange}
                />
              </label>
              {photo ? (
                <button
                  type="button"
                  onClick={() => setPhoto("")}
                  className="ml-3 text-sm text-muted underline"
                >
                  Убрать
                </button>
              ) : null}
              {photoError ? <p className="mt-2 text-xs text-red-700">{photoError}</p> : null}
              <p className="mt-2 text-xs text-muted">
                JPEG/PNG/WebP, автоматически сожмётся до 1000 px
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm">
          <p className="mb-2">Ингредиенты и количество</p>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={ing.name}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((it, j) => (j === i ? { ...it, name: e.target.value } : it)),
                    )
                  }
                  placeholder="Продукт"
                  className="min-h-12 flex-1 rounded-md border border-line bg-paper px-4"
                />
                <input
                  value={ing.amount}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((it, j) => (j === i ? { ...it, amount: e.target.value } : it)),
                    )
                  }
                  placeholder="200 г"
                  className="min-h-12 w-28 rounded-md border border-line bg-paper px-3"
                />
                <button
                  type="button"
                  aria-label="Удалить ингредиент"
                  onClick={() =>
                    setIngredients((prev) =>
                      prev.length > 1 ? prev.filter((_, j) => j !== i) : prev,
                    )
                  }
                  className="min-h-12 w-12 rounded-md border border-line bg-paper text-muted"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIngredients((prev) => [...prev, { name: "", amount: "" }])}
            className="mt-2 min-h-10 rounded-full bg-paper px-5 text-sm"
          >
            + Добавить ингредиент
          </button>
        </div>

        <label className="block text-sm">
          Как готовить
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-md border border-line bg-paper px-4 py-3"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num label="ккал" value={kcal} onChange={setKcal} />
          <Num label="белки" value={protein} onChange={setProtein} />
          <Num label="жиры" value={fat} onChange={setFat} />
          <Num label="углеводы" value={carbs} onChange={setCarbs} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!valid}
            className="min-h-12 rounded-full bg-ink px-8 text-cream disabled:opacity-40"
          >
            {isEdit ? "Сохранить изменения" : "Сохранить рецепт"}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-12 rounded-full bg-paper px-8"
            >
              Отмена
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-3"
      />
    </label>
  );
}
