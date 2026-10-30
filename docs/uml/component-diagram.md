# Диаграмма компонентов

Приложение построено по трёхуровневой клиент-серверной архитектуре:
браузерный SPA-клиент (React), серверный слой TanStack Start (server
functions + better-auth) и уровень данных (PostgreSQL). Клиент и сервер
живут в одном пакете: «server functions» вызываются из компонентов как
обычные функции, а выполняются на сервере.

```mermaid
flowchart TB
  subgraph Client["Клиент — браузер (React 19 + TypeScript + Tailwind)"]
    direction TB
    Pages["Страницы (src/routes)<br/>index · login · register · vhod · kitchen"]
    Components["UI-компоненты<br/>site-nav · Fridge · RecipeList · RecipeForm"]
    MatchLib["Подбор рецептов по продуктам<br/>src/lib/recipes.ts (matchRecipes)"]
    AuthClient["Клиент авторизации<br/>src/lib/auth/client.ts · use-current-user"]
    ApiClient["API-клиент<br/>src/lib/kitchen-api.ts (обёртки server functions)"]
  end

  subgraph Server["Сервер — TanStack Start / Nitro"]
    direction TB
    AuthMW["authMiddleware<br/>(проверка сессии для каждого вызова)"]
    ServerFns["Server functions<br/>listProducts · addProduct · removeProduct<br/>listRecipes · createRecipe · updateRecipe · deleteRecipe"]
    BetterAuth["better-auth<br/>регистрация · вход · сессии · хеши паролей"]
    DbModule["Модуль доступа к БД<br/>src/lib/db.ts (getSql, миграции)"]
    Validator["Валидация входных данных (zod)"]
  end

  subgraph Data["Уровень данных"]
    direction LR
    PG[("PostgreSQL<br/>Neon (prod) / PGLite (dev)<br/>user · session · account · verification<br/>products · recipes")]
    StaticFiles["Статические файлы public/<br/>фото каталога рецептов · favicon"]
  end

  Pages --> Components
  Components --> ApiClient
  Components --> MatchLib
  Pages --> AuthClient
  AuthClient -->|"HTTP /api/auth/*"| BetterAuth
  ApiClient -->|"RPC-вызов (HTTP)"| AuthMW
  AuthMW --> ServerFns
  ServerFns --> Validator
  Validator --> DbModule
  DbModule -->|"параметризованные SQL-запросы"| PG
  BetterAuth -->|"Kysely/pg adapter"| PG
  Components -.->|"img src (каталог)"| StaticFiles
  Components -.->|"img src (свои фото, data-URL)"| PG
```

## Описание компонентов

| Компонент | Зона ответственности |
| --- | --- |
| **Страницы (src/routes)** | Маршрутизация (TanStack Router): лендинг, вход/регистрация, «Кухня» с вкладками Холодильник / Рецепты / Свой рецепт |
| **UI-компоненты** | Отображение и ввод данных: форма продукта, лента карточек рецептов, форма рецепта (ингредиенты с количеством, фото, КБЖУ) |
| **matchRecipes** | Клиентский алгоритм ранжирования рецептов по совпадению ингредиентов с продуктами пользователя |
| **Клиент авторизации** | Сессия текущего пользователя, редиректы неавторизованных пользователей (gates) |
| **API-клиент** | Типизированные обёртки server functions; единая точка вызова CRUD-операций |
| **authMiddleware** | Серверная проверка сессии: каждый вызов API получает `context.userId` или отклоняется |
| **Server functions** | Бизнес-логика CRUD: продукты и рецепты; изоляция данных по `user_id` |
| **Валидатор (zod)** | Схемы входных данных: строки, числа, массив ингредиентов, data-URL фото |
| **better-auth** | Регистрация, вход, управление сессиями и хешами паролей |
| **Модуль БД (getSql)** | Выбор бэкенда (Neon / PGLite), применение миграций, параметризованные запросы |
| **PostgreSQL** | Хранилище пользователей, сессий, продуктов и рецептов (включая фото как data-URL) |
| **Статические файлы** | Фото каталога рецептов и прочие публичные ресурсы |
