import { createFileRoute, Link } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { KitchenUser } from "@/components/site-nav";
import {
  addProduct,
  createRecipe,
  deleteRecipe,
  listProducts,
  listRecipes,
  removeProduct,
  updateRecipe,
  type IngredientItem,
  type ProductRow,
  type RecipeRow,
} from "@/lib/kitchen-api";
import { matchRecipes } from "@/lib/recipes";

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
  const [tab, setTab] = useState<"fridge" | "recipes" | "create">("fridge");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecipeRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listProducts(), listRecipes()])
      .then(([p, r]) => {
        if (cancelled) return;
        setProducts(p);
        setRecipes(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleRecipes = useMemo(
    () => matchRecipes(recipes, products.map((p) => p.name)),
    [recipes, products],
  );

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onAddProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const row = await addProduct({
      data: {
        name: String(data.get("name") ?? ""),
        category: String(data.get("category") ?? ""),
        qty: String(data.get("qty") ?? ""),
      },
    });
    if (row) setProducts((prev) => [row, ...prev]);
    setOpen(false);
    e.currentTarget.reset();
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

  return (
    <main className="min-h-svh bg-cream">
      <header className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
        <Link to="/" className="font-display text-sm tracking-[0.28em] uppercase">
          Gastronomix
        </Link>
        <KitchenUser />
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
          <p className="text-sm text-muted">Загружаем из базы…</p>
        ) : tab === "fridge" ? (
          <Fridge
            products={products}
            onOpen={() => setOpen(true)}
            onRemove={async (id) => {
              await removeProduct({ data: { id } });
              setProducts((prev) => prev.filter((p) => p.id !== id));
            }}
          />
        ) : tab === "recipes" ? (
          <RecipeList
            recipes={visibleRecipes}
            onEdit={(recipe) => {
              setEditing(recipe);
              setTab("create");
            }}
            onDelete={async (id) => {
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
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
                placeholder="Овощи"
              />
            </label>
            <label className="mt-4 block text-sm">
              Количество
              <input
                name="qty"
                className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
                placeholder="3 шт"
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
    </main>
  );
}

function Fridge({
  products,
  onOpen,
  onRemove,
}: {
  products: ProductRow[];
  onOpen: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <section>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
            ХОЛОДИЛЬНИК
          </h1>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-12 rounded-full bg-blush px-6 font-medium text-ink"
        >
          Добавить продукт
        </button>
      </div>
      {products.length === 0 ? (
        <div className="border border-dashed border-line px-6 py-16 text-center">
          <p className="font-serif text-2xl">Пока пусто</p>
          <p className="mt-2 text-sm text-muted">Добавьте продукты — рецепты подстроятся</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 border-b border-line py-4"
            >
              <div>
                <p className="font-serif text-2xl">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.category}
                  {p.qty ? ` · ${p.qty}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="min-h-10 text-sm text-muted underline"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecipeList({
  recipes,
  onEdit,
  onDelete,
}: {
  recipes: RecipeRow[];
  onEdit: (recipe: RecipeRow) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section>
      <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
        РЕЦЕПТЫ
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        30 блюд в каталоге плюс ваши собственные. КБЖУ на порцию.
      </p>
      <div className="grid gap-8 sm:grid-cols-2">
        {recipes.map((r) => (
          <article key={r.id} className="bg-paper">
            <img src={r.image} alt={r.title} className="h-48 w-full object-cover" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-2xl">{r.title}</h2>
                {r.mine ? (
                  <span className="flex shrink-0 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="text-muted underline"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="text-muted underline"
                    >
                      Удалить
                    </button>
                  </span>
                ) : (
                  <span className="rounded-full bg-sage px-2 py-1 text-[10px] tracking-wide uppercase">
                    Каталог
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                {r.timeLabel} · {r.portions} порц.
              </p>
              <ul className="mt-3 grid gap-1 text-sm">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-line/60 pb-1">
                    <span>{ing.name}</span>
                    {ing.amount ? <span className="text-muted">{ing.amount}</span> : null}
                  </li>
                ))}
              </ul>
              {r.instructions ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{r.instructions}</p>
              ) : null}
              <p className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-sage px-3 py-1">{r.kbju.k} ккал</span>
                <span className="rounded-full bg-sage/50 px-3 py-1">Б {r.kbju.b}г</span>
                <span className="rounded-full bg-sage/50 px-3 py-1">Ж {r.kbju.j}г</span>
                <span className="rounded-full bg-sage/50 px-3 py-1">У {r.kbju.u}г</span>
              </p>
            </div>
          </article>
        ))}
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
          ? "Измените поля и сохраните — карточка обновится в ленте"
          : "Сохранится в вашей базе и появится в ленте"}
      </p>
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
