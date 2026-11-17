import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type ProductRow = {
  id: number;
  name: string;
  category: string;
  qty: string;
  /** Срок годности в формате YYYY-MM-DD либо null, если не указан. */
  expiresAt: string | null;
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
  cuisine: string;
  kbju: { k: number; b: number; j: number; u: number };
  mine: boolean;
  favorite: boolean;
};

/** Предпочтения пользователя: жёсткие ограничения + мягкие настройки. */
export type Preferences = {
  // жёсткие ограничения — исключают рецепты из выдачи
  allergens: string[];
  diets: string[];
  stopList: string[];
  // мягкие настройки — влияют на порядок и подсказки
  goal: "none" | "lose" | "gain" | "gi";
  macro: "balance" | "protein" | "lowfat" | "lowcarb";
  dailyKcal: number | null;
  maxMinutes: number | null;
  skill: "novice" | "chef";
  equipment: string[];
  cuisines: string[];
  spice: "any" | "mild" | "hot";
  portionsMode: "single" | "family";
};

export const ALLERGEN_OPTIONS = [
  "глютен",
  "лактоза",
  "орехи",
  "морепродукты",
  "яйца",
  "соя",
  "мёд",
  "цитрусовые",
] as const;

export const DIET_OPTIONS = [
  "вегетарианство",
  "веганство",
  "кето",
  "палео",
  "низкоуглеводная",
  "халяль",
  "кошер",
  "постное",
  "без сахара",
] as const;

export const EQUIPMENT_OPTIONS = ["духовка", "мультиварка", "блендер", "гриль"] as const;

export const CUISINE_OPTIONS = [
  "итальянская",
  "азиатская",
  "кавказская",
  "русская",
  "европейская",
  "мексиканская",
  "американская",
] as const;

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

/**
 * Ключевые слова ингредиентов для жёстких ограничений. Рецепт исключается
 * из выдачи, если в его составе встречается любое слово из выбранной группы.
 */
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  "глютен": ["пшен", "мука", "хлеб", "макарон", "спагетти", "лапша", "булгур", "перлов", "овсян", "сухарик", "тортилья"],
  "лактоза": ["молоко", "сыр", "сметан", "творог", "кефир", "сливк", "йогурт", "масло слив", "фета", "пармезан"],
  "орехи": ["орех", "арахис", "миндаль", "фундук"],
  "морепродукты": ["рыба", "тунец", "лосось", "креветк", "кальмар", "икра", "мидии", "селедк"],
  "яйца": ["яйц", "омлет", "яичниц"],
  "соя": ["соя", "соевый", "тофу"],
  "мёд": ["мёд", "мед "],
  "цитрусовые": ["лимон", "апельсин", "лайм", "цитрус"],
};

const DIET_KEYWORDS: Record<string, string[]> = {
  "вегетарианство": ["куриц", "мясо", "рыба", "индейк", "бекон", "тунец", "фарш", "свинин", "говядин", "ветчин", "печен", "лосось"],
  "веганство": ["куриц", "мясо", "рыба", "индейк", "бекон", "тунец", "фарш", "свинин", "говядин", "ветчин", "печен", "молоко", "сыр", "яйц", "сметан", "творог", "мёд", "мед ", "кефир", "сливк", "йогурт", "фета", "пармезан"],
  "кето": ["сахар", "рис", "макарон", "спагетти", "лапша", "хлеб", "картоф", "булгур", "овсян", "гречк", "тортилья", "мёд", "мед "],
  "палео": ["сахар", "рис", "макарон", "спагетти", "лапша", "хлеб", "картоф", "булгур", "овсян", "гречк", "тортилья", "молоко", "сыр", "сметан", "творог", "сливк", "йогурт", "фета", "пармезан"],
  "низкоуглеводная": ["сахар", "рис", "макарон", "спагетти", "лапша", "хлеб", "картоф", "тортилья", "мёд", "мед "],
  "халяль": ["свинин", "бекон", "ветчин", "алкогол", "вино"],
  "кошер": ["свинин", "бекон", "ветчин"],
  "постное": ["куриц", "мясо", "рыба", "индейк", "бекон", "тунец", "фарш", "свинин", "говядин", "ветчин", "печен", "молоко", "сыр", "яйц", "сметан", "творог", "мёд", "мед ", "кефир", "сливк", "йогурт", "фета", "пармезан"],
  "без сахара": ["сахар", "мёд", "мед ", "варенье"],
};

/** Название + количество превращаются в один текст для поиска по ключевым словам. */
function ingredientsText(items: IngredientItem[]): string {
  return items.map((i) => `${i.name} ${i.amount}`).join(" ").toLowerCase();
}

/** Есть ли в рецепте ингредиент из выбранной группы ограничений. */
function hasKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((k) => haystack.includes(k));
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<ProductRow>`
      select id, name, category, qty, expires_at::text as "expiresAt"
      from products
      where user_id = ${context.userId}
      order by id desc
    `;
  });

/** Дата «сегодня» в локальном часовом поясе сервера — YYYY-MM-DD. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const productSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(60),
  qty: z.string().trim().max(40),
  /** YYYY-MM-DD или пустая строка. */
  expiresAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ожидается дата в формате ГГГГ-ММ-ДД")
    .or(z.literal("")),
});

export const addProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(productSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const expiresAt = data.expiresAt || null;
    const rows = await sql<ProductRow>`
      insert into products (user_id, name, category, qty, expires_at)
      values (${context.userId}, ${data.name}, ${data.category}, ${data.qty}, ${expiresAt})
      returning id, name, category, qty, expires_at::text as "expiresAt"
    `;
    return rows[0];
  });

/**
 * Массовое добавление: пресеты и вставка списка из чека/заметок.
 * Названия приводятся к нижнему регистру первой буквы, дубликаты пропускаются.
 */
export const addProductsBulk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ items: z.array(productSchema).min(1).max(50) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const inserted: ProductRow[] = [];
    for (const item of data.items) {
      const expiresAt = item.expiresAt || null;
      const rows = await sql<ProductRow>`
        insert into products (user_id, name, category, qty, expires_at)
        values (${context.userId}, ${item.name}, ${item.category}, ${item.qty}, ${expiresAt})
        returning id, name, category, qty, expires_at::text as "expiresAt"
      `;
      inserted.push(rows[0]);
    }
    return inserted;
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
  cuisine: string;
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
          ${p}ingredients_json, ${p}portions, ${p}instructions, ${p}image, ${p}cuisine,
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
    cuisine: row.cuisine ?? "",
    kbju: { k: row.kcal, b: row.protein, j: row.fat, u: row.carbs },
    mine: row.user_id === userId,
    favorite: Boolean(row.favorite),
  };
}

/** Строка предпочтений из БД → объект Preferences (jsonb может прийти строкой). */
function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

type PreferencesDb = {
  allergens: unknown;
  diets: unknown;
  stop_list: unknown;
  goal: string;
  macro: string;
  daily_kcal: number | null;
  max_minutes: number | null;
  skill: string;
  equipment: unknown;
  cuisines: unknown;
  spice: string;
  portions_mode: string;
};

const DEFAULT_PREFERENCES: Preferences = {
  allergens: [],
  diets: [],
  stopList: [],
  goal: "none",
  macro: "balance",
  dailyKcal: null,
  maxMinutes: null,
  skill: "novice",
  equipment: [],
  cuisines: [],
  spice: "any",
  portionsMode: "single",
};

/** Читает предпочтения пользователя; если их ещё нет — настройки по умолчанию. */
async function loadPreferences(sql: Sql, userId: string): Promise<Preferences> {
  const rows = await sql<PreferencesDb>`
    select allergens, diets, stop_list, goal, macro, daily_kcal, max_minutes,
           skill, equipment, cuisines, spice, portions_mode
    from user_preferences
    where user_id = ${userId}
  `;
  if (rows.length === 0) return DEFAULT_PREFERENCES;
  const row = rows[0];
  return {
    allergens: parseJsonArray(row.allergens),
    diets: parseJsonArray(row.diets),
    stopList: parseJsonArray(row.stop_list),
    goal: (row.goal as Preferences["goal"]) ?? "none",
    macro: (row.macro as Preferences["macro"]) ?? "balance",
    dailyKcal: row.daily_kcal === null ? null : Number(row.daily_kcal),
    maxMinutes: row.max_minutes === null ? null : Number(row.max_minutes),
    skill: (row.skill as Preferences["skill"]) ?? "novice",
    equipment: parseJsonArray(row.equipment),
    cuisines: parseJsonArray(row.cuisines),
    spice: (row.spice as Preferences["spice"]) ?? "any",
    portionsMode: (row.portions_mode as Preferences["portionsMode"]) ?? "single",
  };
}

/**
 * Жёсткие ограничения пользователя: рецепт исключается, если в его составе
 * найден аллерген, запрещённый диетой продукт или стоп-лист.
 */
function violatesPreferences(recipe: RecipeRow, prefs: Preferences): boolean {
  const haystack = `${recipe.title} ${ingredientsText(recipe.ingredients)}`.toLowerCase();
  for (const allergen of prefs.allergens) {
    if (hasKeyword(haystack, ALLERGEN_KEYWORDS[allergen] ?? [allergen.toLowerCase()])) return true;
  }
  for (const diet of prefs.diets) {
    if (hasKeyword(haystack, DIET_KEYWORDS[diet] ?? [])) return true;
  }
  for (const stop of prefs.stopList) {
    if (haystack.includes(stop.toLowerCase())) return true;
  }
  return false;
}

/**
 * Мягкий ранжирующий балл: чем выше, тем раньше рецепт в выдаче.
 * Учитывает кухни, потолок времени, цель по КБЖУ и сложность.
 */
function preferenceScore(recipe: RecipeRow, prefs: Preferences): number {
  let score = 0;
  if (prefs.cuisines.length > 0 && prefs.cuisines.includes(recipe.cuisine)) score += 3;
  if (prefs.maxMinutes !== null && recipe.minutes <= prefs.maxMinutes) score += 2;
  if (prefs.goal === "lose" && recipe.kbju.k <= 350) score += 2;
  if (prefs.goal === "gain" && recipe.kbju.k >= 400) score += 2;
  if (prefs.goal === "gi" && recipe.kbju.u <= 35) score += 2;
  if (prefs.macro === "protein" && recipe.kbju.b >= 15) score += 1;
  if (prefs.macro === "lowfat" && recipe.kbju.j <= 10) score += 1;
  if (prefs.macro === "lowcarb" && recipe.kbju.u <= 25) score += 1;
  if (prefs.skill === "novice" && recipe.minutes <= 30) score += 1;
  if (prefs.equipment.length > 0) {
    const needs = /духовк|гриль|мультиварк|блендер/i.test(recipe.instructions);
    if (needs && prefs.equipment.length === 0) score -= 1;
  }
  if (recipe.favorite) score += 2;
  return score;
}

/**
 * Лента рецептов: каталог + свои рецепты. Фильтры выполняются в SQL, чтобы
 * не тянуть весь каталог в браузер: поиск по названию/ингредиентам, потолок
 * калорий и времени, режим «только избранное». Поверх SQL применяются
 * предпочтения: жёсткие исключают рецепты (hidden), мягкие меняют порядок.
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

    const prefs = await loadPreferences(sql, context.userId);
    const visible: RecipeRow[] = [];
    let hidden = 0;
    for (const row of rows) {
      const recipe = mapRecipe(row, context.userId);
      if (violatesPreferences(recipe, prefs)) {
        hidden += 1;
        continue;
      }
      visible.push(recipe);
    }
    visible.sort((a, b) => preferenceScore(b, prefs) - preferenceScore(a, prefs));
    return { recipes: visible, hidden };
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

/* ============================ Предпочтения ============================ */

const preferencesSchema = z.object({
  allergens: z.array(z.string().trim().min(1).max(40)).max(16),
  diets: z.array(z.string().trim().min(1).max(40)).max(16),
  stopList: z.array(z.string().trim().min(1).max(40)).max(30),
  goal: z.enum(["none", "lose", "gain", "gi"]),
  macro: z.enum(["balance", "protein", "lowfat", "lowcarb"]),
  dailyKcal: z.number().int().min(0).max(10000).nullable(),
  maxMinutes: z.number().int().min(0).max(600).nullable(),
  skill: z.enum(["novice", "chef"]),
  equipment: z.array(z.string().trim().min(1).max(40)).max(10),
  cuisines: z.array(z.string().trim().min(1).max(40)).max(10),
  spice: z.enum(["any", "mild", "hot"]),
  portionsMode: z.enum(["single", "family"]),
});

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return loadPreferences(sql, context.userId);
  });

export const savePreferences = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(preferencesSchema)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into user_preferences (
        user_id, allergens, diets, stop_list, goal, macro, daily_kcal,
        max_minutes, skill, equipment, cuisines, spice, portions_mode
      )
      values (
        ${context.userId},
        ${JSON.stringify(data.allergens)}::jsonb,
        ${JSON.stringify(data.diets)}::jsonb,
        ${JSON.stringify(data.stopList)}::jsonb,
        ${data.goal},
        ${data.macro},
        ${data.dailyKcal},
        ${data.maxMinutes},
        ${data.skill},
        ${JSON.stringify(data.equipment)}::jsonb,
        ${JSON.stringify(data.cuisines)}::jsonb,
        ${data.spice},
        ${data.portionsMode}
      )
      on conflict (user_id) do update set
        allergens = excluded.allergens,
        diets = excluded.diets,
        stop_list = excluded.stop_list,
        goal = excluded.goal,
        macro = excluded.macro,
        daily_kcal = excluded.daily_kcal,
        max_minutes = excluded.max_minutes,
        skill = excluded.skill,
        equipment = excluded.equipment,
        cuisines = excluded.cuisines,
        spice = excluded.spice,
        portions_mode = excluded.portions_mode,
        updated_at = now()
    `;
    return { ok: true as const };
  });

/* ========================= «Я приготовил это» ========================= */

/** Разбирает количество в граммы или штуки: «200 г», «3 шт», «2 ст. л.». */
function parseAmount(raw: string): { value: number; unit: "g" | "pc" } | null {
  const match = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(г|гр|мл|шт|ст\.?\s*л|ч\.?\s*л|кг|л)?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unitRaw = (match[2] ?? "").toLowerCase().replace(/\s+/g, "");
  if (unitRaw === "шт") return { value, unit: "pc" };
  if (unitRaw === "кг" || unitRaw === "л") return { value: value * 1000, unit: "g" };
  return { value, unit: "g" }; // г, гр, мл, ст. л. и ч. л. считаем граммами
}

type CookProductDb = { id: number; name: string; qty: string };

/**
 * Вычитает граммовки ингредиентов рецепта из продуктов холодильника.
 * Нераспознанные количества («по вкусу») пропускаются; продукты, которых
 * не хватило, возвращаются списком missing.
 */
export const cookRecipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const recipes = await sql.query<RecipeDb>(
      `select ${recipeColumns("r")}, false as favorite
       from recipes r
       where r.id = $2 and (r.user_id is null or r.user_id = $1)`,
      [context.userId, data.id],
    );
    if (recipes.length === 0) throw new Error("Рецепт не найден");
    const recipe = mapRecipe(recipes[0], context.userId);

    const products = await sql<CookProductDb>`
      select id, name, qty from products where user_id = ${context.userId}
    `;

    const used: { name: string; deducted: string }[] = [];
    const missing: string[] = [];
    const skipped: string[] = [];

    for (const ing of recipe.ingredients) {
      const amount = parseAmount(ing.amount);
      if (!amount) continue;
      const needle = ing.name.toLowerCase();
      const match = products.find((p) => {
        const name = p.name.toLowerCase();
        return name.includes(needle) || needle.includes(name);
      });
      if (!match) {
        missing.push(ing.name);
        continue;
      }
      const have = parseAmount(match.qty);
      if (!have) {
        // Количество не распознано — продукт израсходован целиком.
        await sql`delete from products where id = ${match.id} and user_id = ${context.userId}`;
        used.push({ name: match.name, deducted: match.qty });
        continue;
      }
      // Единицы не совпадают (шт против г) — списать честно нельзя.
      if (have.unit !== amount.unit) {
        skipped.push(`${ing.name} (в холодильнике: ${match.qty}, по рецепту: ${ing.amount})`);
        continue;
      }
      const rest = have.value - amount.value;
      const unit = have.unit === "pc" ? "шт" : "г";
      if (rest <= 0) {
        await sql`delete from products where id = ${match.id} and user_id = ${context.userId}`;
        used.push({ name: match.name, deducted: `${have.value} ${unit}` });
      } else {
        await sql`
          update products set qty = ${`${rest} ${unit}`}
          where id = ${match.id} and user_id = ${context.userId}
        `;
        used.push({ name: match.name, deducted: `${amount.value} ${unit}` });
      }
    }

    return { used, missing, skipped };
  });

/* ========================== Планировщик меню ========================== */

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

export type MenuSlot = {
  day: string; // YYYY-MM-DD
  meal: Meal;
  recipe: Pick<RecipeRow, "id" | "title" | "image" | "minutes" | "kbju"> | null;
};

type MenuPlanDb = {
  day: string;
  meal: string;
  id: number;
  title: string;
  image: string;
  minutes: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

/** Понедельник недели, к которой относится дата. */
export function weekMonday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const weekday = date.getUTCDay() || 7; // вс = 7
  date.setUTCDate(date.getUTCDate() - (weekday - 1));
  return date.toISOString().slice(0, 10);
}

function isoPlusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Меню на неделю (7 дней × 4 приёма пищи) для указанного понедельника. */
export const getMenu = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const weekEnd = isoPlusDays(data.weekStart, 6);
    const rows = await sql.query<MenuPlanDb>(
      `select mp.day::text as day, mp.meal, r.id, r.title, r.image, r.minutes,
              r.kcal, r.protein, r.fat, r.carbs
       from menu_plan mp
       join recipes r on r.id = mp.recipe_id
       where mp.user_id = $1
         and mp.day between $2 and $3
       order by mp.day, mp.meal`,
      [context.userId, data.weekStart, weekEnd],
    );
    const slots: MenuSlot[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = isoPlusDays(data.weekStart, i);
      for (const meal of MEALS) {
        const row = rows.find((r) => r.day === day && r.meal === meal);
        slots.push({
          day,
          meal,
          recipe: row
            ? {
                id: row.id,
                title: row.title,
                image: row.image,
                minutes: Number(row.minutes),
                kbju: { k: row.kcal, b: row.protein, j: row.fat, u: row.carbs },
              }
            : null,
        });
      }
    }
    return slots;
  });

export const setMenuSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      meal: z.enum(MEALS),
      recipeId: z.number().int(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const accessible = await sql`
      select id from recipes
      where id = ${data.recipeId} and (user_id is null or user_id = ${context.userId})
    `;
    if (accessible.length === 0) throw new Error("Рецепт не найден");
    await sql`
      insert into menu_plan (user_id, day, meal, recipe_id)
      values (${context.userId}, ${data.day}, ${data.meal}, ${data.recipeId})
      on conflict (user_id, day, meal) do update set recipe_id = excluded.recipe_id
    `;
    return { ok: true as const };
  });

export const removeMenuSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      meal: z.enum(MEALS),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from menu_plan
      where user_id = ${context.userId} and day = ${data.day} and meal = ${data.meal}
    `;
    return { ok: true as const };
  });

/* =========================== Список покупок =========================== */

export type ShoppingItem = {
  name: string;
  category: string;
  needed: number; // сколько требуется по меню (г или шт)
  unit: "g" | "pc";
  have: number; // сколько уже есть в холодильнике
};

/** Категория продукта для группировки чека — по словарю. */
function guessCategory(name: string): string {
  const rules: [RegExp, string][] = [
    [/молок|сыр|сметан|творог|кефир|масло слив|йогурт/, "Молочное"],
    [/куриц|индейк|мясо|фарш|свинин|говядин|бекон|ветчин|печен/, "Мясо"],
    [/рыба|тунец|лосось|креветк/, "Рыба"],
    [/помидор|огур|картоф|морков|лук|капуст|перец|кабач|свекл|чеснок|зелень|салат/, "Овощи"],
    [/яблок|лимон|банан|апельсин/, "Фрукты"],
    [/хлеб|булк|сухарик|лаваш/, "Хлеб"],
    [/мука|сахар|соль|специ|масло раст|сода|дрожж|корица|соус/, "Бакалея"],
    [/яйц/, "Яйца"],
    [/гречк|рис|макарон|спагетти|лапша|овсян|чечевиц|горох|манк/, "Крупы"],
  ];
  for (const [pattern, category] of rules) {
    if (pattern.test(name)) return category;
  }
  return "Прочее";
}

/** Список покупок: сколько нужно по меню минус что есть в холодильнике. */
export const getShoppingList = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const menu = await sql<{ recipe_id: number }>`
      select recipe_id from menu_plan
      where user_id = ${context.userId}
        and day between ${data.weekStart} and ${isoPlusDays(data.weekStart, 6)}
      group by recipe_id
    `;

    const totals = new Map<string, { needed: number; unit: "g" | "pc" }>();
    for (const { recipe_id } of menu) {
      const rows = await sql.query<RecipeDb>(
        `select ${recipeColumns("r")}, false as favorite from recipes r where r.id = $1`,
        [recipe_id],
      );
      if (rows.length === 0) continue;
      const recipe = mapRecipe(rows[0], context.userId);
      for (const ing of recipe.ingredients) {
        const amount = parseAmount(ing.amount);
        if (!amount) continue;
        const key = ing.name.toLowerCase();
        const current = totals.get(key);
        if (current && current.unit === amount.unit) {
          current.needed += amount.value;
        } else if (!current) {
          totals.set(key, { needed: amount.value, unit: amount.unit });
        }
      }
    }

    const products = await sql<{ name: string; qty: string }>`
      select name, qty from products where user_id = ${context.userId}
    `;

    const items: ShoppingItem[] = [];
    for (const [name, { needed, unit }] of totals) {
      const haveEntry = products.find((p) => {
        const pn = p.name.toLowerCase();
        return pn.includes(name) || name.includes(pn);
      });
      const haveParsed = haveEntry ? parseAmount(haveEntry.qty) : null;
      const have =
        haveParsed && haveParsed.unit === unit ? haveParsed.value : haveParsed?.value ?? 0;
      const rest = Math.max(0, needed - have);
      // Продукт уже покрыт холодильником — в список покупок не попадает.
      if (rest <= 0) continue;
      items.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        category: guessCategory(name),
        needed: rest,
        unit,
        have: Math.min(have, needed),
      });
    }
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return items;
  });
