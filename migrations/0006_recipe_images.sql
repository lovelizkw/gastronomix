-- Подходящие фотографии для рецептов каталога.
--
-- Раньше часть блюд делила одну картинку или использовала фото, не
-- соответствующее рецепту. Здесь каждому рецепту каталога назначается
-- отдельное фото блюда; файлы лежат в public/images/recipes/.
-- Обновляется только каталог (user_id is null) — фотографии, загруженные
-- пользователями, не затрагиваются. Повторный запуск безопасен.
update recipes
set image = v.image
from (values
  ('Томатный суп',                          '/images/recipes/tomato-soup.jpg'),
  ('Крем-суп с зеленью',                    '/images/recipes/cream-soup.jpg'),
  ('Песто из зелени',                       '/images/recipes/pesto.jpg'),
  ('Шакшука',                               '/images/recipes/shakshuka.jpg'),
  ('Простой салат',                         '/images/recipes/simple-salad.jpg'),
  ('Омлет с зеленью',                       '/images/recipes/omelette.jpg'),
  ('Курица с рисом',                        '/images/recipes/chicken-rice.jpg'),
  ('Овощное рагу',                          '/images/recipes/vegetable-stew.jpg'),
  ('Блины на молоке',                       '/images/recipes/blini.jpg'),
  ('Гречка с грибами',                      '/images/recipes/buckwheat.jpg'),
  ('Паста с сыром',                         '/images/recipes/pasta-cheese.jpg'),
  ('Творожная запеканка',                   '/images/recipes/zapekanka.jpg'),
  ('Рыба с лимоном',                        '/images/recipes/baked-fish.jpg'),
  ('Чечевичный суп',                        '/images/recipes/lentil-soup.jpg'),
  ('Овсяная каша',                          '/images/recipes/oatmeal.jpg'),
  ('Яичница с помидорами',                  '/images/recipes/eggs-tomatoes.jpg'),
  ('Сэндвич с индейкой, авокадо и томатами', '/images/recipes/turkey-sandwich.jpg'),
  ('Борщ упрощённый',                       '/images/recipes/borscht.jpg'),
  ('Плов с курицей',                        '/images/recipes/pilaf.jpg'),
  ('Салат «Греческий»',                     '/images/recipes/greek-salad.jpg'),
  ('Лечо из перца',                         '/images/recipes/lecho.jpg'),
  ('Сырники со сметаной',                   '/images/recipes/syrniki.jpg'),
  ('Куриный бульон с сухариками',           '/images/recipes/chicken-broth.jpg'),
  ('Картофельное пюре',                     '/images/recipes/mashed-potato.jpg'),
  ('Тосты с авокадо и яйцом',               '/images/recipes/avocado-toast.jpg'),
  ('Рис с овощами',                         '/images/recipes/rice-vegetables.jpg'),
  ('Запечённые яблоки с мёдом',             '/images/recipes/baked-apples.jpg'),
  ('Яичный рулет с сыром',                  '/images/recipes/egg-roll.jpg'),
  ('Грибной крем-суп',                      '/images/recipes/mushroom-soup.jpg'),
  ('Макароны по-флотски',                   '/images/recipes/pasta-meat.jpg')
) as v(title, image)
where recipes.user_id is null
  and recipes.title = v.title;
