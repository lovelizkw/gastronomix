-- Избранные рецепты и числовое время приготовления.
--
-- favorites — связь пользователь ↔ рецепт. Каталог общий для всех, поэтому
-- избранное хранится отдельно и не меняет сами рецепты. Пара
-- (user_id, recipe_id) уникальна; при удалении рецепта записи чистятся каскадом.
create table if not exists favorites (
  user_id    text not null,
  recipe_id  integer not null references recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index if not exists favorites_user_id_idx on favorites (user_id);
create index if not exists favorites_recipe_id_idx on favorites (recipe_id);

-- minutes — время приготовления числом, чтобы фильтровать «до N минут».
-- time_label остаётся для показа («30 мин»), minutes — для запросов.
alter table recipes add column if not exists minutes integer not null default 30;

-- Перенос значений из текстового time_label: берём ведущее число минут.
-- Если формат не распознан, остаётся значение по умолчанию 30.
update recipes
set minutes = coalesce((substring(time_label from '^[0-9]+'))::int, 30)
where time_label ~ '^[0-9]+';
