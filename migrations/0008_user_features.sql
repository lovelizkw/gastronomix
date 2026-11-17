-- Пользовательские предпочтения, сроки годности продуктов и планировщик меню.
--
-- user_preferences — одна строка на пользователя. Разделено на жёсткие
-- ограничения (аллергены, диеты, стоп-лист — исключают рецепты из выдачи)
-- и мягкие настройки (цель, время, техника, кухни — влияют на порядок).
create table if not exists user_preferences (
  user_id       text primary key,
  -- жёсткие ограничения
  allergens     jsonb not null default '[]'::jsonb,
  diets         jsonb not null default '[]'::jsonb,
  stop_list     jsonb not null default '[]'::jsonb,
  -- мягкие настройки
  goal          text not null default 'none',        -- none | lose | gain | gi
  macro         text not null default 'balance',     -- balance | protein | lowfat | lowcarb
  daily_kcal    integer,
  max_minutes   integer,
  skill         text not null default 'novice',      -- novice | chef
  equipment     jsonb not null default '[]'::jsonb,
  cuisines      jsonb not null default '[]'::jsonb,
  spice         text not null default 'any',         -- any | mild | hot
  portions_mode text not null default 'single',      -- single | family
  updated_at    timestamptz not null default now()
);

-- Срок годности продукта (необязательно). «Умная строка» подставляет +7 дней.
alter table products add column if not exists expires_at date;

-- Планировщик меню: одна ячейка = один приём пищи одного дня.
create table if not exists menu_plan (
  user_id   text not null,
  day       date not null,
  meal      text not null,                -- breakfast | lunch | dinner | snack
  recipe_id integer not null references recipes (id) on delete cascade,
  primary key (user_id, day, meal)
);
create index if not exists menu_plan_user_day_idx on menu_plan (user_id, day);
