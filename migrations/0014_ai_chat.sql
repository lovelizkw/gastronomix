-- Пометка «создано ИИ» у рецептов и хранение истории чата с шеф-ИИ.
--
-- created_by_ai — рецепт сгенерирован шеф-ИИ (показываем чипс «ИИ» на карточке).
-- Такие рецепты привязаны к автору (user_id), фото у них нет — автор
-- может добавить своё через редактирование.
alter table recipes add column if not exists created_by_ai boolean not null default false;

-- Рецепты, добавленные через ИИ-каталог ранее, помечаем и снимаем
-- автоматически подобранные фото.
update recipes
set created_by_ai = true, image = ''
where user_id is null
  and title in (
    'Курица с овощами в соевом соусе',
    'Куриные котлеты с сыром',
    'Куриные рулетики с грибами',
    'Куриные крылышки в медово-горчичном соусе'
  );

-- chat_messages — история диалога с шеф-ИИ, общая для всех поверхностей чата.
create table if not exists chat_messages (
  id         serial primary key,
  user_id    text not null,
  role       text not null,           -- user | assistant
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on chat_messages (user_id, created_at);
