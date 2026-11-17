-- Аналитика «Ноль отходов», журнал готовки и умные замены ингредиентов.
--
-- product_events — что происходило с продуктами: добавление, списание при
-- готовке, выбрасывание. На её базе считаются сэкономленные граммовки,
-- топ покупок и топ выбрасываемых продуктов.
create table if not exists product_events (
  id           serial primary key,
  user_id      text not null,
  product_name text not null,
  action       text not null,           -- added | cooked | discarded
  grams        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_events_user_idx on product_events (user_id, created_at);

-- cook_log — «Я приготовил это»: рецепт, порции и КБЖУ на дату.
-- Даёт распределение КБЖУ за неделю в аналитике.
create table if not exists cook_log (
  id         serial primary key,
  user_id    text not null,
  recipe_id  integer not null references recipes (id) on delete cascade,
  title      text not null,
  portions   integer not null default 1,
  kcal       integer not null default 0,
  protein    integer not null default 0,
  fat        integer not null default 0,
  carbs      integer not null default 0,
  cooked_at  timestamptz not null default now()
);
create index if not exists cook_log_user_idx on cook_log (user_id, cooked_at);

-- ingredient_substitutes — таблица эквивалентов для «Чем заменить?».
-- substitutes — jsonb-массив допустимых замен. Сид идемпотентный.
create table if not exists ingredient_substitutes (
  ingredient  text primary key,
  substitutes jsonb not null default '[]'::jsonb
);

insert into ingredient_substitutes (ingredient, substitutes)
select * from (values
  ('сметан',  '["греческий йогурт","творог","кефир"]'::jsonb),
  ('сливк',   '["молоко","греческий йогурт"]'::jsonb),
  ('молоко',  '["кефир","сливки"]'::jsonb),
  ('кефир',   '["молоко","греческий йогурт"]'::jsonb),
  ('творог',  '["греческий йогурт","сметана"]'::jsonb),
  ('сыр',     '["творог","моцарелла"]'::jsonb),
  ('масло слив', '["масло растительное","маргарин"]'::jsonb),
  ('масло',   '["оливковое масло","подсолнечное масло"]'::jsonb),
  ('майонез', '["греческий йогурт","сметана"]'::jsonb),
  ('куриц',   '["индейка","фарш"]'::jsonb),
  ('индейк',  '["куриное филе","курица"]'::jsonb),
  ('фарш',    '["куриное филе","свинина"]'::jsonb),
  ('лосось',  '["рыба","тунец"]'::jsonb),
  ('рыба',    '["тунец","лосось"]'::jsonb),
  ('тунец',   '["рыба","яйца"]'::jsonb),
  ('мёд',     '["сахар","сироп"]'::jsonb),
  ('сахар',   '["мёд","сироп"]'::jsonb),
  ('лимон',   '["лайм","уксус"]'::jsonb),
  ('помидор', '["томатная паста","томаты в собственном соку"]'::jsonb),
  ('перец болгарский', '["помидоры","кабачок"]'::jsonb),
  ('кабачок', '["баклажан","перец"]'::jsonb),
  ('капуста', '["пекинская капуста","брокколи"]'::jsonb),
  ('грибы',   '["кабачок","баклажан"]'::jsonb),
  ('зелень',  '["зелёный лук","шпинат"]'::jsonb),
  ('чеснок',  '["лук","сухой чеснок"]'::jsonb),
  ('лук',     '["чеснок","лук-порей"]'::jsonb),
  ('хлеб',    '["сухарики","лаваш"]'::jsonb)
) as v(ingredient, substitutes)
where not exists (
  select 1 from ingredient_substitutes s where s.ingredient = v.ingredient
);
