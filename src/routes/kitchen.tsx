import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  type ProductRow,
  type RecipeRow,
} from "@/lib/kitchen-api";
import { matchRecipes } from "@/lib/recipes";

export const Route = createFileRoute("/kitchen")({ component: KitchenPage });

function KitchenPage() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<"fridge" | "recipes" | "create">("fridge");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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

  async function onCreateRecipe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const row = await createRecipe({
      data: {
        title: String(data.get("title") ?? ""),
        timeLabel: String(data.get("timeLabel") ?? "30 мин"),
        ingredients: String(data.get("ingredients") ?? ""),
        instructions: String(data.get("instructions") ?? ""),
        kcal: Number(data.get("kcal") || 0),
        protein: Number(data.get("protein") || 0),
        fat: Number(data.get("fat") || 0),
        carbs: Number(data.get("carbs") || 0),
      },
    });
    if (row) {
      setRecipes((prev) => [row, ...prev]);
      setTab("recipes");
    }
    e.currentTarget.reset();
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
              onClick={() => setTab(id)}
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
            onDelete={async (id) => {
              await deleteRecipe({ data: { id } });
              setRecipes((prev) => prev.filter((r) => r.id !== id));
            }}
          />
        ) : (
          <CreateForm onSubmit={onCreateRecipe} />
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
  onDelete,
}: {
  recipes: RecipeRow[];
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
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="text-xs text-muted underline"
                  >
                    Удалить
                  </button>
                ) : (
                  <span className="rounded-full bg-sage px-2 py-1 text-[10px] tracking-wide uppercase">
                    Каталог
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                {r.timeLabel} · {r.ingredients.join(", ")}
              </p>
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

function CreateForm({ onSubmit }: { onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section>
      <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
        СВОЙ РЕЦЕПТ
      </h1>
      <p className="mt-2 mb-8 text-sm text-muted">Сохранится в вашей базе и появится в ленте</p>
      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <label className="block text-sm">
          Название
          <input
            name="title"
            required
            className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
          />
        </label>
        <label className="block text-sm">
          Время
          <input
            name="timeLabel"
            placeholder="30 мин"
            className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
          />
        </label>
        <label className="block text-sm">
          Ингредиенты через запятую
          <input
            name="ingredients"
            required
            placeholder="помидор, лук, масло"
            className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-4"
          />
        </label>
        <label className="block text-sm">
          Как готовить
          <textarea
            name="instructions"
            rows={4}
            className="mt-2 w-full rounded-md border border-line bg-paper px-4 py-3"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num name="kcal" label="ккал" />
          <Num name="protein" label="белки" />
          <Num name="fat" label="жиры" />
          <Num name="carbs" label="углеводы" />
        </div>
        <button type="submit" className="min-h-12 rounded-full bg-ink px-8 text-cream">
          Сохранить рецепт
        </button>
      </form>
    </section>
  );
}

function Num({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        defaultValue={0}
        className="mt-2 min-h-12 w-full rounded-md border border-line bg-paper px-3"
      />
    </label>
  );
}
