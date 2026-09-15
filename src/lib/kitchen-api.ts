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

export type RecipeRow = {
  id: number;
  userId: string | null;
  title: string;
  timeLabel: string;
  ingredients: string[];
  instructions: string;
  image: string;
  kbju: { k: number; b: number; j: number; u: number };
  mine: boolean;
};

function splitIngredients(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
  ingredients: string;
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
    ingredients: splitIngredients(row.ingredients),
    instructions: row.instructions,
    image: row.image,
    kbju: { k: row.kcal, b: row.protein, j: row.fat, u: row.carbs },
    mine: row.user_id === userId,
  };
}

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<RecipeDb>`
      select id, user_id, title, time_label, ingredients, instructions, image, kcal, protein, fat, carbs
      from recipes
      where user_id is null or user_id = ${context.userId}
      order by (user_id is null), id
    `;
    return rows.map((r) => mapRecipe(r, context.userId));
  });

export const createRecipe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      title: z.string().trim().min(2).max(80),
      timeLabel: z.string().trim().max(40),
      ingredients: z.string().trim().min(2).max(400),
      instructions: z.string().trim().max(2000),
      kcal: z.number().int().min(0).max(5000),
      protein: z.number().int().min(0).max(500),
      fat: z.number().int().min(0).max(500),
      carbs: z.number().int().min(0).max(500),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<RecipeDb>`
      insert into recipes (
        user_id, title, time_label, ingredients, instructions, image, kcal, protein, fat, carbs
      )
      values (
        ${context.userId},
        ${data.title},
        ${data.timeLabel || "30 мин"},
        ${data.ingredients},
        ${data.instructions},
        ${"/images/tomato-soup.jpg"},
        ${data.kcal},
        ${data.protein},
        ${data.fat},
        ${data.carbs}
      )
      returning id, user_id, title, time_label, ingredients, instructions, image, kcal, protein, fat, carbs
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
