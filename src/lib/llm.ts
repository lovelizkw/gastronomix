import "./load-env.server";

/**
 * Клиент YandexGPT (Yandex Cloud AI Studio, Responses API) для серверных
 * функций. Ключ и каталог задаются в .env: YC_API_KEY, YC_FOLDER_ID.
 * Если их нет, функции ИИ честно сообщают об этом.
 */

const RESPONSES_URL = "https://ai.api.cloud.yandex.net/v1/responses";

export function llmEnabled(): boolean {
  return Boolean(process.env.YC_API_KEY?.trim() && process.env.YC_FOLDER_ID?.trim());
}

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

function friendlyError(status: number, text: string): Error {
  if (status === 401 || status === 403) {
    return new Error(
      "YandexGPT отклонил ключ или права — проверьте YC_API_KEY / YC_FOLDER_ID и роль ai.assistants.editor у сервисного аккаунта",
    );
  }
  if (status === 402) {
    return new Error("На балансе Yandex Cloud нет средств — проверьте статус гранта в консоли облака");
  }
  if (status === 429) {
    return new Error("Слишком много запросов к ИИ — подождите минуту и попробуйте снова");
  }
  return new Error(`ИИ ответил ошибкой ${status}: ${text.slice(0, 160)}`);
}

type ResponsesPayload = {
  output?: { content?: { text?: string; type?: string }[] }[];
  status?: string;
};

function extractText(payload: ResponsesPayload): string {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text" || typeof c.text === "string")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
}

/** Один запрос к YandexGPT; возвращает текст ответа. */
export async function llmComplete(
  messages: LlmMessage[],
  options: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.YC_API_KEY?.trim();
  const folderId = process.env.YC_FOLDER_ID?.trim();
  if (!apiKey || !folderId) {
    throw new Error(
      "Шеф-ИИ не подключён: задайте YC_API_KEY и YC_FOLDER_ID в файле .env проекта",
    );
  }
  const model = process.env.YC_MODEL?.trim() || "yandexgpt-lite";

  // system-сообщения уходят в instructions, остальные — в input (история чата).
  const instructions = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      model: `gpt://${folderId}/${model}/latest`,
      ...(instructions ? { instructions } : {}),
      input,
      temperature: options.json ? 0.3 : 0.6,
      max_output_tokens: options.maxTokens ?? 2000,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw friendlyError(res.status, text);
  }

  const payload = (await res.json()) as ResponsesPayload;
  return extractText(payload);
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
