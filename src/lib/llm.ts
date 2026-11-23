/**
 * Клиент DeepSeek (OpenAI-совместимый API) для серверных функций.
 * Ключ читается из переменной окружения DEEPSEEK_API_KEY.
 * Если ключ не задан, функции LLM честно сообщают об этом.
 */

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export function llmEnabled(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

/** Один запрос к модели; возвращает текст ответа. */
export async function llmComplete(
  messages: LlmMessage[],
  options: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("LLM не подключён: задайте DEEPSEEK_API_KEY в .env");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: options.maxTokens ?? 2000,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ответил ошибкой ${res.status}: ${text.slice(0, 160)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Запрос с ожиданием корректного JSON в ответе. */
export async function llmJson<T>(messages: LlmMessage[], maxTokens?: number): Promise<T> {
  const text = await llmComplete(messages, { json: true, maxTokens });
  // Модели иногда оборачивают JSON в ```json … ``` — срезаем.
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned) as T;
}

/** Выкачивает страницу и превращает её в компактный текст для модели. */
export async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Gastronomix/1.0 (educational project)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`сайт ответил ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}
