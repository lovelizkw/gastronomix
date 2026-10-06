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
  ingredients: IngredientItem[];
  portions: number;
  instructions: string;
  image: string;
  kbju: { k: number; b: number; j: number; u: number };
  mine: boolean;
};

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.string().trim().max(40),
});

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

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<RecipeDb>`
      select id, user_id, title, time_label, ingredients, ingredients_json, portions,
             instructions, image, kcal, protein, fat, carbs
      from recipes
      where user_id is null or user_id = ${context.userId}
      order by (user_id is null), id
    `;
    return rows.map((r) => mapRecipe(r, context.userId));
  });

type RecipeDb = {
  id: number;
  user_id: string | null;
  title: string;
  time_label: string;
  ingredients: string;
  ingredients_json: unknown;
  portions: number;
  instructions: string;
  image: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

function mapRecipe(row: RecipeDb, userId: string): RecipeRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    timeLabel: row.time_label,
    ingredients: parseIngredients(row.ingredients_json, row.ingredients),
    portions: Number(row.portions) || 1,
    instructions: row.instructions,
    image: row.image,
    kbju: { k: row.kcal, b: row.protein, j: row.fat, u: row.carbs },
    mine: row.user_id === userId,
  };
}

export const createRecipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      title: z.string().trim().min(2).max(80),
      timeLabel: z.string().trim().max(40),
      ingredients: z.array(ingredientSchema).min(1).max(30),
      portions: z.number().int().min(1).max(20),
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
    const rows = await sql<RecipeDb>`
      insert into recipes (
        user_id, title, time_label, ingredients, ingredients_json, portions,
        instructions, image, kcal, protein, fat, carbs
      )
      values (
        ${context.userId},
        ${data.title},
        ${data.timeLabel || "30 мин"},
        ${ingredientsText},
        ${JSON.stringify(data.ingredients)},
        ${data.portions},
        ${data.instructions},
        ${"/images/tomato-soup.jpg"},
        ${data.kcal},
        ${data.protein},
        ${data.fat},
        ${data.carbs}
      )
      returning id, user_id, title, time_label, ingredients, ingredients_json, portions,
                instructions, image, kcal, protein, fat, carbs
    `;
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
