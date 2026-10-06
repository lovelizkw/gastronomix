-- Детализация рецептов: ингредиенты с количеством и число порций.
--
-- ingredients_json — массив объектов {"name": "...", "amount": "..."}:
-- название продукта и его количество («200 г», «3 шт»). Храним как jsonb,
-- чтобы структура проверялась и искалась средствами Postgres.
-- Старая текстовая колонка ingredients остаётся (список названий через
-- запятую) — её использует подбор рецептов по продуктам из «Холодильника».
alter table recipes add column if not exists ingredients_json jsonb not null default '[]'::jsonb;
alter table recipes add column if not exists portions integer not null default 2;

-- Перенос существующих данных: «помидор, лук, масло» -> [{"name":"помидор","amount":""},…]
update recipes
set ingredients_json = coalesce(
  (select jsonb_agg(jsonb_build_object('name', trim(x.item), 'amount', '') order by x.ord)
   from unnest(string_to_array(recipes.ingredients, ',')) with ordinality as x(item, ord)
   where length(trim(x.item)) > 0),
  '[]'::jsonb)
where ingredients_json = '[]'::jsonb
  and coalesce(recipes.ingredients, '') <> '';
