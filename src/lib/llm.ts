import "./load-env.server";

/**
 * Клиент LLM для серверных функций. Поддерживаются два провайдера:
 * - YandexGPT (ключ YC_API_KEY + каталог YC_FOLDER_ID из Yandex Cloud);
 * - DeepSeek (ключ DEEPSEEK_API_KEY) — остаётся как запасной вариант.
 * Провайдер выбирается автоматически по наличию переменных окружения.
 */

const YANDEX_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

export function llmEnabled(): boolean {
  return activeProvider() !== null;
}

function activeProvider(): "yandex" | "deepseek" | null {
  if (process.env.YC_API_KEY?.trim() && process.env.YC_FOLDER_ID?.trim()) return "yandex";
  if (process.env.DEEPSEEK_API_KEY?.trim()) return "deepseek";
  return null;
}

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

function friendlyError(status: number, text: string): Error {
  if (status === 401 || status === 403) {
    return new Error("Провайдер отклонил ключ — проверьте YC_API_KEY / YC_FOLDER_ID в файле .env");
  }
  if (status === 402) {
    return new Error("На балансе провайдера нет средств — пополните аккаунт или напишите мне, и я подстрою проект");
  }
  if (status === 429) {
    return new Error("Слишком много запросов к ИИ — подождите минуту и попробуйте снова");
  }
  return new Error(`ИИ ответил ошибкой ${status}: ${text.slice(0, 160)}`);
}

/** Один запрос к активной модели; возвращает текст ответа. */
export async function llmComplete(
  messages: LlmMessage[],
  options: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error(
      "Шеф-ИИ не подключён: задайте YC_API_KEY и YC_FOLDER_ID в файле .env проекта",
    );
  }
  const maxTokens = options.maxTokens ?? 2000;

  let url: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (provider === "yandex") {
    const model = process.env.YC_MODEL?.trim() || "yandexgpt-lite";
    url = YANDEX_URL;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${process.env.YC_API_KEY!.trim()}`,
    };
    body = {
      modelUri: `gpt://${process.env.YC_FOLDER_ID!.trim()}/${model}/latest`,
      messages: messages.map((m) => ({ role: m.role, text: m.content })),
      maxTokens,
      temperature: options.json ? 0.3 : 0.6,
    };
  } else {
    url = DEEPSEEK_URL;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY!.trim()}`,
    };
    body = {
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: maxTokens,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw friendlyError(res.status, text);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    result?: { alternatives?: { message?: { text?: string } }[] };
  };
  if (provider === "yandex") {
    return json.result?.alternatives?.[0]?.message?.text?.trim() ?? "";
  }
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Запрос с ожиданием корректного JSON в ответе. */
export async function llmJson<T>(messages: LlmMessage[], maxTokens?: number): Promise<T> {
  const text = await llmComplete(
    [...messages, { role: "user", content: "Ответь только корректным JSON без пояснений." }],
    { json: true, maxTokens },
  );
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned) as T;
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
