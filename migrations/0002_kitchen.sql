create table if not exists products (
  id         serial primary key,
  user_id    text not null,
  name       text not null,
  category   text not null default '',
  qty        text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists products_user_id_idx on products (user_id);

create table if not exists recipes (
  id            serial primary key,
  user_id       text,
  title         text not null,
  time_label    text not null default '30 мин',
  ingredients   text not null,
  instructions  text not null default '',
  image         text not null default '/images/coock.jpg',
  kcal          integer not null default 0,
  protein       integer not null default 0,
  fat           integer not null default 0,
  carbs         integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists recipes_user_id_idx on recipes (user_id);
