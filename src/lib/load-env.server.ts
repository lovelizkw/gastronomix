import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Загружает `.env` из корня проекта в process.env — до этого переменные
 * вроде YC_API_KEY не попадали в серверный процесс (Vite раздаёт
 * в браузер только VITE_-префиксные значения). Уже заданные переменные
 * не перезаписываются. Файл может отсутствовать — тогда это no-op.
 * Корень считается от этого файла (src/lib/../../.env), а не от cwd,
 * потому что рабочий каталог SSR-процесса не гарантирован.
 */
try {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const raw = readFileSync(resolve(root, ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env нет — секреты берутся из окружения деплоя.
}
