import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({ component: Home });

/** Публичный фрагмент каталога для витрины на главной (без авторизации). */
const SHOWCASE = [
  { title: "Паста карбонара", image: "/images/recipes/carbonara.jpg", kcal: 430, minutes: 25 },
  { title: "Салат «Цезарь»", image: "/images/recipes/caesar-salad.jpg", kcal: 320, minutes: 20 },
  { title: "Шакшука", image: "/images/recipes/shakshuka.jpg", kcal: 260, minutes: 20 },
  { title: "Крем-брюле", image: "/images/recipes/creme-brulee.jpg", kcal: 380, minutes: 60 },
  { title: "Гаспачо", image: "/images/recipes/gazpacho.jpg", kcal: 120, minutes: 15 },
  { title: "Кесадилья с курицей", image: "/images/recipes/quesadilla.jpg", kcal: 380, minutes: 20 },
  { title: "Тыквенный крем-суп", image: "/images/recipes/pumpkin-soup.jpg", kcal: 150, minutes: 40 },
  { title: "Паста с сыром", image: "/images/recipes/pasta-cheese.jpg", kcal: 380, minutes: 20 },
];

function Home() {
  return (
    <main className="bg-cream text-ink">
      <Hero />
      <Features />
      <Showcase />
      <Steps />
      <Invite />
    </main>
  );
}

/** Витрина: горизонтальная карусель блюд со стрелками и точками (референс 2). */
function Showcase() {
  const [index, setIndex] = useState(0);
  const visible = 5;
  const max = SHOWCASE.length - visible;
  const offset = Math.min(index, max);

  return (
    <section className="relative overflow-hidden bg-sage-deep/10 px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-section font-light leading-[0.9] tracking-tight text-sage-deep">
          ЧТО ГОТОВИМ
          <br />
          В ЭТОЙ НЕДЕЛЕ
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          Каталог из 55 блюд с КБЖУ и пошаговыми инструкциями. Внутри — фильтры
          по калориям и времени, избранное и режим шеф-повара.
        </p>
      </div>

      <div className="relative mx-auto mt-12 max-w-6xl">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={offset === 0}
          aria-label="Назад"
          className="absolute left-0 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-xl shadow-md disabled:opacity-30"
        >
          ‹
        </button>
        <div className="overflow-hidden px-12">
          <div
            className="flex gap-5 transition-transform duration-500 ease-out"
            style={{ transform: `translateX(calc(-${offset} * (20% + 1rem)))` }}
          >
            {SHOWCASE.map((item, i) => (
              <article
                key={item.title}
                className="gx-card-hover w-[62vw] shrink-0 sm:w-[38vw] md:w-[19%]"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className={`aspect-[3/4] w-full rounded-lg object-cover shadow-md ${
                    i === offset + 2 ? "md:-translate-y-3 md:shadow-xl" : ""
                  }`}
                />
                <p className="mt-3 text-center font-serif text-lg">{item.title}</p>
                <p className="text-center text-xs text-muted">
                  {item.kcal} ккал · {item.minutes} мин
                </p>
              </article>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(max, i + 1))}
          disabled={offset >= max}
          aria-label="Вперёд"
          className="absolute right-0 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-xl shadow-md disabled:opacity-30"
        >
          ›
        </button>
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: max + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
              className={`size-2 rounded-full ${i === offset ? "bg-sage-deep" : "bg-line"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Секция «Что это такое» — светлые карточки с плюсом (референс 5). */
function Features() {
  const cards = [
    { t: "Цифровой холодильник", d: "Пишете, что есть дома — продукты с количеством и сроком годности.", icon: "+", img: "/images/recipes/tomato-soup.jpg" },
    { t: "Умный подбор", d: "Система показывает блюда из имеющихся продуктов и считает совпадения.", icon: "◯", img: "/images/recipes/caesar-salad.jpg" },
    { t: "Понятное КБЖУ", d: "Калории, белки, жиры и углеводы на каждом рецепте и в меню на неделю.", icon: "✕", img: "/images/recipes/borscht.jpg" },
  ];

  return (
    <section className="bg-cream px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-center">
          <h2 className="font-display text-section font-light leading-[0.85] tracking-tight text-sage-deep">
            КУХНЯ,
            <br />
            КОТОРАЯ
            <br />
            СЧИТАЕТ
          </h2>
          <div className="space-y-6">
            <p className="max-w-md text-sm leading-relaxed text-muted">
              Gastronomix — цифровой холодильник с умным подбором рецептов:
              он знает, что лежит на полке, и предлагает блюда, которые можно
              приготовить прямо сейчас.
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted">
              А шеф-ИИ подскажет, чем заменить сметану и что приготовить
              из трёх продуктов и пучка зелени.
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {cards.map((card, i) => (
            <article
              key={card.t}
              className={`gx-card-hover relative rounded-lg bg-paper p-6 pt-10 ${i === 0 ? "gx-rise" : i === 1 ? "gx-rise-2" : "gx-rise-3"}`}
            >
              <span className="absolute -top-4 left-6 flex size-9 items-center justify-center rounded-full bg-ink text-lg text-cream">
                {card.icon}
              </span>
              <img
                src={card.img}
                alt=""
                className="absolute -top-6 right-6 size-16 gx-float rounded-full object-cover shadow-md"
              />
              <h3 className="font-serif text-2xl">{card.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{card.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Как это работает — 4 шага с иллюстрацией. */
function Steps() {
  const steps = [
    { n: "01", t: "Регистрация", d: "Имя, почта, пароль — и личный кабинет готов." },
    { n: "02", t: "Холодильник", d: "Добавляете продукты: молоко, томаты, яйца." },
    { n: "03", t: "Рецепты", d: "Система показывает блюда из того, что уже есть." },
    { n: "04", t: "КБЖУ", d: "Калории, белки, жиры, углеводы — на карточке рецепта." },
  ];

  return (
    <section className="bg-cream px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-section font-light leading-[0.85] tracking-tight text-sage-deep">
          КАК
          <br />
          ЭТО
          <br />
          РАБОТАЕТ
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          {steps.map((s) => (
            <article key={s.n} className="border-t border-line pt-5">
              <p className="font-display text-sm tracking-[0.2em] text-sage-deep">{s.n}</p>
              <h3 className="mt-2 font-serif text-3xl">{s.t}</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{s.d}</p>
            </article>
          ))}
        </div>
        <img
          src="/images/fridge.jpg"
          alt="Холодильник"
          className="mt-16 h-72 w-full rounded-lg object-cover md:h-[28rem]"
        />
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <SiteNav />
      {/* Парящие продукты: тёплая подача из нашей палитры */}
      <img
        src="/images/recipes/tomato-soup.jpg"
        alt=""
        aria-hidden
        className="gx-float pointer-events-none absolute -left-6 top-24 hidden size-28 rounded-full object-cover shadow-xl md:block xl:-left-2 xl:size-44"
      />
      <img
        src="/images/recipes/caesar-salad.jpg"
        alt=""
        aria-hidden
        className="gx-float-slow pointer-events-none absolute right-[4%] top-32 hidden size-24 rounded-full object-cover shadow-lg md:block xl:right-[8%] xl:size-32"
      />
      <img
        src="/images/recipes/creme-brulee.jpg"
        alt=""
        aria-hidden
        className="gx-float pointer-events-none absolute bottom-24 left-[14%] hidden size-20 rounded-full object-cover shadow-lg md:block xl:left-[18%] xl:size-24"
        style={{ animationDelay: "1.5s" }}
      />
      <img
        src="/images/recipes/shakshuka.jpg"
        alt=""
        aria-hidden
        className="gx-float-slow pointer-events-none absolute bottom-40 right-[12%] hidden size-16 rounded-full object-cover shadow-lg md:block xl:right-[16%] xl:size-20"
        style={{ animationDelay: "2.2s" }}
      />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-center px-5 pb-24 pt-32 text-center md:px-10">
        <span className="gx-rise mb-8 inline-flex size-12 items-center justify-center rounded-full bg-sage-deep text-sm font-semibold text-cream">
          GX
        </span>
        <h1 className="gx-rise font-display text-display font-light leading-[0.82] tracking-tight text-ink md:leading-[0.78]">
          GASTRO
          <br />
          NOMIX
        </h1>
        <p className="gx-rise-2 mt-8 max-w-md text-sm leading-relaxed text-muted md:text-base">
          Цифровой холодильник, каталог из 55 рецептов с КБЖУ, планировщик меню
          и шеф-ИИ, который подскажет, что приготовить из того, что уже есть.
        </p>
        <div className="gx-rise-3 mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="flex min-h-12 items-center rounded-full bg-ink px-8 font-medium text-cream transition-transform hover:scale-[1.03]"
          >
            Создать аккаунт
          </Link>
          <Link
            to="/login"
            className="flex min-h-12 items-center rounded-full border border-line bg-paper px-8 font-medium text-ink"
          >
            Войти
          </Link>
        </div>
        <div className="gx-rise-3 mt-16 flex flex-wrap justify-center gap-6 text-xs text-muted">
          <span className="rounded-full border border-line bg-paper px-4 py-2">55 рецептов</span>
          <span className="rounded-full border border-line bg-paper px-4 py-2">КБЖУ на порцию</span>
          <span className="rounded-full border border-line bg-paper px-4 py-2">Ноль отходов</span>
          <span className="rounded-full border border-line bg-paper px-4 py-2">✨ Шеф-ИИ</span>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: "01", t: "Регистрация", d: "Имя, почта, пароль — и личный кабинет готов." },
    { n: "02", t: "Холодильник", d: "Добавляете продукты: молоко, томаты, яйца." },
    { n: "03", t: "Рецепты", d: "Система показывает блюда из того, что уже есть." },
    { n: "04", t: "КБЖУ", d: "Калории, белки, жиры, углеводы — на карточке рецепта." },
  ];

  return (
    <section className="bg-cream px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-section font-light leading-[0.85] tracking-tight text-sage-deep">
          КАК
          <br />
          ЭТО
          <br />
          РАБОТАЕТ
        </h2>
        <div className="mt-14 grid gap-10 md:grid-cols-2">
          {steps.map((s) => (
            <article key={s.n} className="border-t border-line pt-5">
              <p className="font-display text-sm tracking-[0.2em] text-sage-deep">{s.n}</p>
              <h3 className="mt-2 font-serif text-3xl">{s.t}</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{s.d}</p>
            </article>
          ))}
        </div>
        <img
          src="/images/fridge.jpg"
          alt="Холодильник"
          className="mt-16 h-72 w-full object-cover md:h-[28rem]"
        />
      </div>
    </section>
  );
}

function Invite() {
  return (
    <section className="bg-sage-deep/10 px-5 py-24 text-center md:py-32">
      <p className="font-serif text-5xl text-sage-deep md:text-7xl">食</p>
      <h2 className="mx-auto mt-4 max-w-3xl font-display text-section font-light leading-[0.85] tracking-tight text-sage-deep">
        ЗАЙДИТЕ
        <br />
        НА КУХНЮ
      </h2>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/register"
          className="flex min-h-12 items-center rounded-full bg-ink px-8 py-3 font-medium text-cream transition-transform hover:scale-[1.03]"
        >
          Создать аккаунт
        </Link>
        <Link
          to="/login"
          className="flex min-h-12 items-center rounded-full border border-line bg-paper px-8 py-3 font-medium text-ink"
        >
          Войти
        </Link>
      </div>
    </section>
  );
}
