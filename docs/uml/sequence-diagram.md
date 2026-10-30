# Диаграммы последовательностей

## 1. Регистрация и вход пользователя

```mermaid
sequenceDiagram
  autonumber
  actor U as Пользователь
  participant P as Страница register / login
  participant BA as better-auth (/api/auth/*)
  participant DB as PostgreSQL
  participant K as Страница «Кухня»

  U->>P: Имя, email, пароль (регистрация)
  P->>BA: signUpEmail(...)
  BA->>DB: insert into "user" / "account" (хеш пароля)
  DB-->>BA: ok
  BA-->>P: Set-Cookie: сессия
  P->>K: Перенаправление на /kitchen

  Note over U,DB: Последующий вход
  U->>P: Email + пароль
  P->>BA: signIn.email(...)
  BA->>DB: проверка хеша в "account"
  alt Пароль неверный
    DB-->>BA: нет совпадения
    BA-->>P: 401 Unauthorized
    P-->>U: Сообщение об ошибке
  else Успех
    DB-->>BA: пользователь найден
    BA->>DB: insert into "session"
    BA-->>P: Set-Cookie: сессия
    P->>K: Перенаправление на /kitchen
    K->>BA: getSession() (useCurrentUserState)
    BA-->>K: Данные пользователя
    K-->>U: Холодильник, рецепты, форма своего рецепта
  end
```

## 2. Создание своего рецепта (фото + ингредиенты + КБЖУ)

```mermaid
sequenceDiagram
  autonumber
  actor U as Пользователь
  participant F as RecipeForm (браузер)
  participant SF as createRecipe (server function)
  participant MW as authMiddleware
  participant V as zod-валидатор
  participant DB as PostgreSQL

  U->>F: Название, время, порции
  U->>F: Строки ингредиентов «продукт + количество»
  U->>F: КБЖУ (ккал, белки, жиры, углеводы)
  U->>F: Выбор файла фото (JPEG/PNG/WebP)
  F->>F: createImageBitmap → canvas: сжатие до 1000 px, JPEG q≈0.75
  F-->>U: Превью фото
  U->>F: «Сохранить рецепт»
  F->>SF: createRecipe({ data }) (RPC через HTTP)
  SF->>MW: контекст запроса (cookie сессии)
  MW->>DB: select из "session" + "user"
  alt Сессия недействительна
    DB-->>MW: нет сессии
    MW-->>SF: 401
    SF-->>F: ошибка авторизации
    F-->>U: редирект на страницу входа
  else Сессия действительна
    DB-->>MW: userId
    MW-->>SF: context.userId
    SF->>V: проверка схемы (название, ингредиенты[], image, КБЖУ, порции)
    alt Данные невалидны
      V-->>SF: ошибка валидации
      SF-->>F: 400 + описание
      F-->>U: сообщение об ошибке
    else Данные валидны
      V-->>SF: нормализованные данные
      SF->>DB: insert into recipes (user_id, title, ingredients,<br/>ingredients_json, portions, image, kcal, protein, fat, carbs)<br/>returning …
      DB-->>SF: строка рецепта
      SF-->>F: RecipeRow (mine = true)
      F->>F: карточка добавлена в ленту, вкладка «Рецепты»
      F-->>U: рецепт отображается с фото и КБЖУ
    end
  end
```

## 3. Подбор рецептов по «Холодильнику» (клиентская логика)

```mermaid
sequenceDiagram
  autonumber
  actor U as Пользователь
  participant K as Страница «Кухня»
  participant API as listProducts / listRecipes (server functions)
  participant DB as PostgreSQL
  participant M as matchRecipes (клиент)

  U->>K: Открытие вкладки «Рецепты»
  K->>API: listProducts(), listRecipes() — параллельно
  API->>DB: select продуктов по user_id;<br/>select каталога (user_id is null) + своих рецептов
  DB-->>API: строки
  API-->>K: ProductRow[], RecipeRow[]
  K->>M: matchRecipes(recipes, productNames)
  M->>M: подсчёт совпадений ингредиентов,<br/>сортировка по числу совпадений
  M-->>K: упорядоченный список
  K-->>U: сначала блюда из имеющихся продуктов
```
