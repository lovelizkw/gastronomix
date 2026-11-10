import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type ProductRow = {
  id: number;
  name: string;
  category: string;
  qty: string;
};

/** Ингредиент рецепта: название + количество («200 г», «3 шт»). */
export type IngredientItem = { name: string; amount: string };

export type RecipeRow = {
  id: number;
  userId: string | null;
  title: string;
  timeLabel: string;
  minutes: number;
  ingredients: IngredientItem[];
  portions: number;
  instructions: string;
  image: string;
  kbju: { k: number; b: number; j: number; u: number };
  mine: boolean;
  favorite: boolean;
};

export type ProfileRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  recipes: number;
  products: number;
  favorites: number;
};

export type RecipeFilters = {
  q?: string;
  maxKcal?: number;
  maxMinutes?: number;
  favoritesOnly?: boolean;
};

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.string().trim().max(40),
});

/** Ограничение на data-URL фото: ~2,6 МБ файла в base64-представлении. */
const IMAGE_MAX_CHARS = 3_500_000;

/** Картинка по умолчанию для рецепта без загруженного фото. */
const DEFAULT_RECIPE_IMAGE = "/images/recipes/tomato-soup.jpg";

/**
 * Фото рецепта: пустая строка (возьмём картинку по умолчанию), путь к файлу
 * из каталога /images/ либо data-URL (jpeg/png/webp), который клиент готовит
 * из загруженного файла с уменьшением размера и сжатием.
 */
const imageSchema = z
  .string()
  .max(IMAGE_MAX_CHARS)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/images/") ||
      /^data:image\/(jpeg|png|webp);base64,/.test(v),
    "Ожидается путь /images/... или data-URL изображения (JPEG/PNG/WebP)",
  );

/**
 * ingredients_json приходит из Postgres уже распарсенным (jsonb) либо строкой —
 * поддерживаем оба варианта и откатываемся к старой текстовой колонке.
 */
function parseIngredients(raw: unknown, legacyText: string): IngredientItem[] {
  let items: unknown = raw;
  if (typeof raw === "string") {
    try {
      items = JSON.parse(raw);
    } catch {
      items = [];
    }
  }
  if (Array.isArray(items)) {
    const parsed = items
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((i) => ({ name: String(i.name ?? "").trim(), amount: String(i.amount ?? "").trim() }))
      .filter((i) => i.name.length > 0);
    if (parsed.length > 0) return parsed;
  }
  return legacyText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, amount: "" }));
}

/** Плоский список названий для текстовой колонки ingredients (подбор по холодильнику). */
function ingredientsToText(items: IngredientItem[]): string {
  return items
    .map((i) => i.name)
    .filter(Boolean)
    .join(", ");
}

/** «45 мин» → 45; нераспознанное значение — 30 минут по умолчанию. */
function parseMinutes(label: string): number {
  const match = label.match(/\d+/);
  const value = match ? Number(match[0]) : NaN;
  return Number.isFinite(value) && value > 0 && value <= 600 ? value : 30;
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<ProductRow>`
      select id, name, category, qty
      from products
      where user_id = ${context.userId}
      order by id desc
    `;
  });

export const addProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(80),
      category: z.string().trim().max(60),
      qty: z.string().trim().max(40),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<ProductRow>`
      insert into products (user_id, name, category, qty)
      values (${context.userId}, ${data.name}, ${data.category}, ${data.qty})
      returning id, name, category, qty
    `;
    return rows[0];
  });

export const removeProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from products
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

type RecipeDb = {
  id: number;
  user_id: string | null;
  title: string;
  time_label: string;
  minutes: number;
  ingredients: string;
  ingredients_json: unknown;
  portions: number;
  instructions: string;
  image: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  favorite: boolean;
};

/** Список колонок рецепта с необязательным префиксом таблицы (`r.`). */
function recipeColumns(prefix = ""): string {
  const p = prefix ? `${prefix}.` : "";
  return `${p}id, ${p}user_id, ${p}title, ${p}time_label, ${p}minutes, ${p}ingredients,
          ${p}ingredients_json, ${p}portions, ${p}instructions, ${p}image,
          ${p}kcal, ${p}protein, ${p}fat, ${p}carbs`;
}

/** Есть ли рецепт в избранном у пользователя — коррелированный подзапрос. */
function favoriteColumn(prefix = ""): string {
  const p = prefix ? `${prefix}.` : "";
  return `exists (
    select 1 from favorites f
    where f.recipe_id = ${p}id and f.user_id = $1
  ) as favorite`;
}

function mapRecipe(row: RecipeDb, userId: string): RecipeRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    timeLabel: row.time_label,
    minutes: Number(row.minutes) || parseMinutes(row.time_label),
    ingredients: parseIngredients(row.ingredients_json, row.ingredients),
    portions: Number(row.portions) || 1,
    instructions: row.instructions,
    image: row.image,
    kbju: { k: row.kcal, b: row.protein, j: row.fat, u: row.carbs },
    mine: row.user_id === userId,
    favorite: Boolean(row.favorite),
  };
}

/**
 * Лента рецептов: каталог + свои рецепты. Фильтры выполняются в SQL, чтобы
 * не тянуть весь каталог в браузер: поиск по названию/ингредиентам, потолок
 * калорий и времени, режим «только избранное».
 */
export const listRecipes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        q: z.string().trim().max(80).optional(),
        maxKcal: z.number().int().min(0).max(5000).optional(),
        maxMinutes: z.number().int().min(0).max(600).optional(),
        favoritesOnly: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const params: unknown[] = [context.userId];
    const where = ["(r.user_id is null or r.user_id = $1)"];

    if (data?.q) {
      params.push(`%${data.q.toLowerCase()}%`);
      where.push(
        `(lower(r.title) like $${params.length} or lower(r.ingredients) like $${params.length})`,
      );
    }
    if (data?.maxKcal) {
      params.push(data.maxKcal);
      where.push(`r.kcal <= $${params.length}`);
    }
    if (data?.maxMinutes) {
      params.push(data.maxMinutes);
      where.push(`r.minutes <= $${params.length}`);
    }
    if (data?.favoritesOnly) {
      where.push("exists (select 1 from favorites f where f.recipe_id = r.id and f.user_id = $1)");
    }

    const rows = await sql.query<RecipeDb>(
      `select ${recipeColumns("r")}, ${favoriteColumn("r")}
       from recipes r
       where ${where.join(" and ")}
       order by (r.user_id is null), r.id`,
      params,
    );
    return rows.map((r) => mapRecipe(r, context.userId));
  });

/** Один рецепт: каталог или собственный. null — если недоступен. */
export const getRecipe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<RecipeDb>(
      `select ${recipeColumns("r")}, ${favoriteColumn("r")}
       from recipes r
       where r.id = $2 and (r.user_id is null or r.user_id = $1)`,
      [context.userId, data.id],
    );
    if (rows.length === 0) return null;
    return mapRecipe(rows[0], context.userId);
  });

/** Добавляет рецепт в избранное или убирает его оттуда. */
export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const accessible = await sql`
      select id from recipes
      where id = ${data.id} and (user_id is null or user_id = ${context.userId})
    `;
    if (accessible.length === 0) throw new Error("Рецепт не найден");

    const existing = await sql`
      select 1 from favorites
      where user_id = ${context.userId} and recipe_id = ${data.id}
    `;
    if (existing.length > 0) {
      await sql`
        delete from favorites
        where user_id = ${context.userId} and recipe_id = ${data.id}
      `;
      return { favorite: false };
    }
    await sql`
      insert into favorites (user_id, recipe_id)
      values (${context.userId}, ${data.id})
      on conflict do nothing
    `;
    return { favorite: true };
  });

export const createRecipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      title: z.string().trim().min(2).max(80),
      timeLabel: z.string().trim().max(40),
      ingredients: z.array(ingredientSchema).min(1).max(30),
      portions: z.number().int().min(1).max(20),
      image: imageSchema,
      instructions: z.string().trim().max(2000),
      kcal: z.number().int().min(0).max(5000),
      protein: z.number().int().min(0).max(500),
      fat: z.number().int().min(0).max(500),
      carbs: z.number().int().min(0).max(500),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const ingredientsText = ingredientsToText(data.ingredients);
    const timeLabel = data.timeLabel || "30 мин";
    const rows = await sql<RecipeDb>`
      insert into recipes (
        user_id, title, time_label, minutes, ingredients, ingredients_json, portions,
        instructions, image, kcal, protein, fat, carbs
      )
      values (
        ${context.userId},
        ${data.title},
        ${timeLabel},
        ${parseMinutes(timeLabel)},
        ${ingredientsText},
        ${JSON.stringify(data.ingredients)},
        ${data.portions},
        ${data.instructions},
        ${data.image || DEFAULT_RECIPE_IMAGE},
        ${data.kcal},
        ${data.protein},
        ${data.fat},
        ${data.carbs}
      )
      returning id, user_id, title, time_label, minutes, ingredients, ingredients_json,
                portions, instructions, image, kcal, protein, fat, carbs, false as favorite
    `;
    return mapRecipe(rows[0], context.userId);
  });

export const updateRecipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int(),
      title: z.string().trim().min(2).max(80),
      timeLabel: z.string().trim().max(40),
      ingredients: z.array(ingredientSchema).min(1).max(30),
      portions: z.number().int().min(1).max(20),
      image: imageSchema,
      instructions: z.string().trim().max(2000),
      kcal: z.number().int().min(0).max(5000),
      protein: z.number().int().min(0).max(500),
      fat: z.number().int().min(0).max(500),
      carbs: z.number().int().min(0).max(500),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const ingredientsText = ingredientsToText(data.ingredients);
    const timeLabel = data.timeLabel || "30 мин";
    // user_id в условии — гарантия, что чужой рецепт изменить нельзя.
    const rows = await sql<RecipeDb>`
      update recipes set
        title = ${data.title},
        time_label = ${timeLabel},
        minutes = ${parseMinutes(timeLabel)},
        ingredients = ${ingredientsText},
        ingredients_json = ${JSON.stringify(data.ingredients)},
        portions = ${data.portions},
        instructions = ${data.instructions},
        image = ${data.image || DEFAULT_RECIPE_IMAGE},
        kcal = ${data.kcal},
        protein = ${data.protein},
        fat = ${data.fat},
        carbs = ${data.carbs}
      where id = ${data.id} and user_id = ${context.userId}
      returning id, user_id, title, time_label, minutes, ingredients, ingredients_json,
                portions, instructions, image, kcal, protein, fat, carbs,
                exists (select 1 from favorites f
                        where f.recipe_id = recipes.id and f.user_id = ${context.userId}) as favorite
    `;
    if (rows.length === 0) throw new Error("Рецепт не найден или принадлежит другому пользователю");
    return mapRecipe(rows[0], context.userId);
  });

export const deleteRecipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from recipes
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

type ProfileDb = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

/** Профиль текущего пользователя и счётчики его данных. */
export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const users = await sql<ProfileDb>`
      select id, name, email, "createdAt"::text as created_at
      from "user"
      where id = ${context.userId}
    `;
    if (users.length === 0) return null;

    const counts = await sql<{ recipes: number; products: number; favorites: number }>`
      select
        (select count(*)::int from recipes where user_id = ${context.userId}) as recipes,
        (select count(*)::int from products where user_id = ${context.userId}) as products,
        (select count(*)::int from favorites where user_id = ${context.userId}) as favorites
    `;
    const user = users[0];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
      recipes: counts[0]?.recipes ?? 0,
      products: counts[0]?.products ?? 0,
      favorites: counts[0]?.favorites ?? 0,
    } satisfies ProfileRow;
  });

/** Изменение отображаемого имени. */
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().trim().min(2).max(60) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<ProfileDb>`
      update "user"
      set name = ${data.name}, "updatedAt" = now()
      where id = ${context.userId}
      returning id, name, email, "createdAt"::text as created_at
    `;
    return rows[0] ? { id: rows[0].id, name: rows[0].name, email: rows[0].email } : null;
  });
