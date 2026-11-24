import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { fetchPageText, llmEnabled, llmComplete, llmJson } from "@/lib/llm";

/* ============================ Чтение ссылок LLM ======================== */

/** Публичный статус подключения ИИ — для подсказок в интерфейсе. */
export const llmStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { enabled: llmEnabled() };
});

const ParsedRecipe = z.object({
  title: z.string().trim().min(2).max(80),
  ingredients: z
    .array(z.object({ name: z.string().trim().min(1).max(80), amount: z.string().trim().max(40) }))
    .min(1)
    .max(30),
  instructions: z.string().trim().min(1).max(2000),
});

export type ParsedRecipe = z.infer<typeof ParsedRecipe>;

/**
 * LLM-импорт: страница без разметки schema.org разбирается моделью.
 * Возвращает рецепт в том же формате, что и JSON-LD-парсер.
 */
export const importRecipeWithLlm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ url: z.string().trim().url().max(500) }))
  .handler(async ({ data }) => {
  if (!llmEnabled()) {
      throw new Error(
        "Шеф-ИИ не подключён: задайте YC_API_KEY и YC_FOLDER_ID в файле .env проекта",
      );
    }
    const pageText = await fetchPageText(data.url);
    const parsed = await llmJson<unknown>([
      {
        role: "system",
        content:
          "Ты извлекаешь рецепты из текста кулинарных страниц. Отвечай ТОЛЬКО JSON " +
          'формата: {"title": "...", "ingredients": [{"name": "...", "amount": "..."}], ' +
          '"instructions": "1. шаг\\n2. шаг"}. Правила для ingredients: name — ТОЛЬКО ' +
          "название продукта без чисел и единиц измерения; amount — количество " +
          "(«200 г», «2 шт», «1 стакан»). Если в тексте встречаются эквиваленты " +
          "вроде «= 210 г» — оставь их в amount через пробел или выбрось. Названия и " +
          "количества — на русском, как в исходном рецепте. Если это не рецепт — " +
          "верни пустой ingredients.",
      },
      { role: "user", content: pageText },
    ], 2500);

    const result = ParsedRecipe.safeParse(parsed);
    if (!result.success || result.data.ingredients.length === 0) {
      throw new Error("LLM не нашёл на странице рецепт. Попробуйте другой адрес.");
    }
    const data2 = result.data;
    return {
      title: data2.title,
      ingredients: data2.ingredients,
      instructions: data2.instructions,
    };
  });

/* ============================ Помощник-чат ============================= */

export const assistantChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      message: z.string().trim().min(1).max(500),
      history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
        .max(10)
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!llmEnabled()) {
      throw new Error(
        "Шеф-ИИ не подключён: задайте YC_API_KEY и YC_FOLDER_ID в файле .env проекта",
      );
    }
    const sql = await getSql();
    const products = await sql<{ name: string; qty: string }>`
      select name, qty from products where user_id = ${context.userId} order by id desc limit 40
    `;
    const recipes = await sql<{ title: string; minutes: number }>`
      select title, minutes from recipes where user_id is null order by id limit 40
    `;
    const fridge = products.length
      ? products.map((p) => `${p.name} (${p.qty})`).join(", ")
      : "пусто";
    const catalog = recipes.map((r) => `${r.title} (${r.minutes} мин)`).join(", ");

    const reply = await llmComplete(
      [
        {
          role: "system",
          content:
            "Ты — дружелюбный шеф-повар в приложении Gastronomix. Отвечай кратко (до 120 слов), " +
            "по-русски, без markdown-разметки. Учитывай холодильник пользователя и каталог рецептов. " +
            `Холодильник: ${fridge}. Каталог: ${catalog}. ` +
            "Если просят блюдо из имеющегося — предлагай из каталога или простой вариант по шагам.",
        },
        ...(data.history ?? []),
        { role: "user", content: data.message },
      ],
      { maxTokens: 800 },
    );
    return { reply };
  });

/* ======================= Генерация рецептов в каталог =================== */

const GeneratedRecipe = z.object({
  title: z.string().trim().min(2).max(80),
  timeLabel: z.string().trim().min(1).max(40),
  cuisine: z.string().trim().max(40),
  portions: z.number().int().min(1).max(20),
  ingredients: z
    .array(z.object({ name: z.string().trim().min(1).max(80), amount: z.string().trim().max(40) }))
    .min(1)
    .max(30)
    .transform((list) =>
      list
        .map((i) => ({
          // Название — без эквивалентов «= 210 г» и прочего мусора.
          name: i.name
            .replace(/=\s*\d+(?:[.,]\d+)?\s*(?:г|гр|мл|л|кг|шт)?\s*/gi, "")
            .replace(/[()]+/g, "")
            .replace(/\s{2,}/g, " ")
            .trim(),
          amount: i.amount,
        }))
        .filter((i) => i.name.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "").length >= 2),
    ),
  instructions: z.string().trim().min(1).max(2000),
  kcal: z.number().int().min(0).max(5000),
  protein: z.number().int().min(0).max(500),
  fat: z.number().int().min(0).max(500),
  carbs: z.number().int().min(0).max(500),
});

export type GeneratedRecipe = z.infer<typeof GeneratedRecipe>;

/** Просит LLM придумать 5 рецептов по теме и вернуть структурированный JSON. */
export const generateRecipes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ theme: z.string().trim().min(2).max(120) }))
  .handler(async ({ data }) => {
    if (!llmEnabled()) {
      throw new Error(
        "Шеф-ИИ не подключён: задайте YC_API_KEY и YC_FOLDER_ID в файле .env проекта",
      );
    }
    const parsed = await llmJson<{ recipes: unknown[] }>(
      [
        {
          role: "system",
          content:
            "Ты — шеф-повар и методист проекта Gastronomix. Придумай РОВНО 5 простых домашних " +
            "рецептов по заданной теме. Отвечай ТОЛЬКО JSON: {\"recipes\": [{\"title\": ..., " +
            '"timeLabel": "35 мин", "cuisine": "русская|итальянская|азиатская|кавказская|' +
            'европейская|мексиканская|американская", "portions": 2, "ingredients": ' +
            '[{"name": "...", "amount": "200 г"}], "instructions": "1. ...\\n2. ...\\n3. ..." ' +
            "(4-6 шагов), \"kcal\": int на порцию, \"protein\": int, \"fat\": int, " +
            "\"carbs\": int}]}. Все тексты на русском, граммовки точные, блюда разные.",
        },
        { role: "user", content: `Тема: ${data.theme}` },
      ],
      4000,
    );
    const recipes = (parsed.recipes ?? [])
      .map((r) => GeneratedRecipe.safeParse(r))
      .filter((r) => r.success)
      .map((r) => r.data)
      .slice(0, 5);
    if (recipes.length === 0) throw new Error("LLM вернул некорректные рецепты, попробуйте ещё раз");
    return recipes;
  });

/**
 * Сохраняет одобренные рецепты в каталог: привязка к автору не ставится —
 * рецепт становится общим. Фото подбирается по совпадению названия с
 * существующими картинками, иначе — нейтральное фото по умолчанию.
 */
export const saveGeneratedRecipes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ recipes: z.array(GeneratedRecipe).min(1).max(5) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const images = await sql<{ image: string; title: string }>`
      select image, title from recipes where user_id is null
    `;
    const created: string[] = [];
    for (const recipe of data.recipes) {
      const exists = await sql`
        select 1 from recipes where user_id is null and lower(title) = lower(${recipe.title})
      `;
      if (exists.length > 0) continue;
      const lowerTitle = recipe.title.toLowerCase();
      const matched =
        images.find((i) => lowerTitle.includes(i.title.toLowerCase().slice(0, 8)))?.image ??
        images.find((i) => i.title.toLowerCase().includes(lowerTitle.slice(0, 8)))?.image ??
        "/images/recipes/tomato-soup.jpg";
      const minutesMatch = recipe.timeLabel.match(/\d+/);
      await sql`
        insert into recipes (
          user_id, title, time_label, minutes, ingredients, ingredients_json, portions,
          instructions, image, kcal, protein, fat, carbs, cuisine
        ) values (
          null, ${recipe.title}, ${recipe.timeLabel}, ${Number(minutesMatch?.[0]) || 30},
          ${recipe.ingredients.map((i) => i.name).join(", ")},
          ${JSON.stringify(recipe.ingredients)}::jsonb, ${recipe.portions},
          ${recipe.instructions}, ${matched}, ${recipe.kcal}, ${recipe.protein},
          ${recipe.fat}, ${recipe.carbs}, ${recipe.cuisine || "европейская"}
        )
      `;
      created.push(recipe.title);
    }
    return { created };
  });
