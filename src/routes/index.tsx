import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({ component: Home });

/** Публичная витрина блюд для карусели (без авторизации). */
const SHOWCASE = [
  { title: "Паста карбонара", image: "/images/recipes/carbonara.jpg", kcal: 430, minutes: 25 },
  { title: "Салат «Цезарь»", image: "/images/recipes/caesar-salad.jpg", kcal: 320, minutes: 20 },
  { title: "Шакшука", image: "/images/recipes/shakshuka.jpg", kcal: 260, minutes: 20 },
  { title: "Крем-брюле", image: "/images/recipes/creme-brulee.jpg", kcal: 380, minutes: 60 },
  { title: "Гаспачо", image: "/images/recipes/gazpacho.jpg", kcal: 120, minutes: 15 },
  { title: "Кесадилья с курицей", image: "/images/recipes/quesadilla.jpg", kcal: 380, minutes: 20 },
  { title: "Тыквенный крем-суп", image: "/images/recipes/pumpkin-soup.jpg", kcal: 150, minutes: 40 },
  { title: "Лазанья с фаршем", image: "/images/recipes/lasagna.jpg", kcal: 320, minutes: 75 },
  { title: "Хачапури по-аджарски", image: "/images/recipes/khachapuri.jpg", kcal: 380, minutes: 60 },
  { title: "Паста с сыром", image: "/images/recipes/pasta-cheese.jpg", kcal: 380, minutes: 20 },
];

const CARD_COLORS = [
  "bg-blush/70",
  "bg-sage/70",
  "bg-lilac/50",
  "bg-sage-deep/30",
  "bg-blush/40",
];

function Home() {
  return (
    <main className="bg-cream text-ink">
      <Hero />
      <Showcase />
      <Features />
      <Steps />
      <Invite />
    </main>
  );
}

/** Герой в стиле «The Bowl»: цветные капли, круглая тарелка, парящие детали. */
function Hero() {
  return (
    <section className="relative overflow-hidden rounded-b-[3rem] bg-sage-deep/10">
      <SiteNav />
      {/* Цветные капли фона */}
      <div className="pointer-events-none absolute -left-32 top-10 size-[26rem] rounded-[46%_54%_58%_42%/50%_42%_58%_50%] bg-sage/60" />
      <div className="pointer-events-none absolute -right-40 -top-24 size-[30rem] rounded-[54%_46%_40%_60%/46%_58%_42%_54%] bg-blush/70" />
      <div className="pointer-events-none absolute -bottom-48 right-[12%] size-[24rem] rounded-[42%_58%_56%_44%/52%_44%_56%_48%] bg-lilac/40" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-24 pt-28 md:grid-cols-2 md:px-10">
        <div className="order-2 md:order-1">
          <h1 className="gx-rise font-display text-6xl font-light leading-[0.9] tracking-tight text-ink md:text-7xl">
            Еда дома —{" "}
            <span className="text-sage-deep">это</span>{" "}
            <span className="text-blush-deep">просто</span>
          </h1>
          <p className="gx-rise-2 mt-6 max-w-md text-sm leading-relaxed text-muted md:text-base">
            Цифровой холодильник: запишите, что есть дома — Gastronomix подберёт
            блюда, посчитает КБЖУ и соберёт список покупок. Каталог из 100 рецептов,
            недельное меню и шеф-ИИ, который знает ваш холодильник.
          </p>
          <div className="gx-rise-3 mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="flex min-h-12 items-center rounded-full bg-ink px-8 font-medium text-cream transition-transform hover:scale-[1.03]"
            >
              Начать готовить
            </Link>
            <Link
              to="/login"
              className="flex min-h-12 items-center rounded-full border border-line bg-paper px-8 font-medium text-ink"
            >
              Войти
            </Link>
          </div>
          {/* Мини-превью блюд, как в референсе 1 */}
          <div className="gx-rise-3 mt-10 flex gap-3">
            {SHOWCASE.slice(0, 5).map((item, i) => (
              <img
                key={item.title}
                src={item.image}
                alt=""
                aria-hidden
                className={`size-14 rounded-full object-cover shadow-md ${i === 2 ? "gx-float ring-4 ring-cream" : ""}`}
                style={{ animationDelay: `${i * 0.7}s` }}
              />
            ))}
          </div>
        </div>

        {/* Большая круглая тарелка с парящими продуктами */}
        <div className="relative order-1 flex justify-center md:order-2">
          <img
            src="/images/recipes/caesar-salad.jpg"
            alt="Салат «Цезарь»"
            className="size-64 rounded-full object-cover shadow-2xl md:size-[22rem]"
          />
          <img
            src="/images/recipes/tomato-soup.jpg"
            alt=""
            aria-hidden
            className="gx-float pointer-events-none absolute -left-2 top-2 size-20 rounded-full object-cover shadow-lg md:size-24"
          />
          <img
            src="/images/recipes/gazpacho.jpg"
            alt=""
            aria-hidden
            className="gx-float-slow pointer-events-none absolute bottom-0 right-0 size-16 rounded-full object-cover shadow-lg md:size-20"
            style={{ animationDelay: "1.4s" }}
          />
          <span className="gx-float-slow absolute -right-1 top-6 rotate-12 rounded-full bg-blush px-4 py-2 text-xs font-semibold text-ink shadow-md">
            КБЖУ на порцию
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Карусель в стиле «Foody»/«Groceria»: белая скруглённая панель с карточками,
 * у каждой — круглое фото на цветной подложке (без рамок).
 */
function Showcase() {
  const [index, setIndex] = useState(0);
  const visible = 4;
  const max = SHOWCASE.length - visible;
  const offset = Math.min(index, max);

  return (
    <section className="relative overflow-hidden bg-cream px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-section font-light leading-[0.9] tracking-tight text-sage-deep">
          Популярное
          <br />
          в каталоге
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          100 блюд с КБЖУ и пошаговыми инструкциями. Внутри — фильтры по калориям
          и времени, избранное и режим шеф-повара.
        </p>
      </div>

      <div className="relative mx-auto mt-12 max-w-5xl">
        {/* Белая панель со стрелками, как в референсе 2 */}
        <div className="rounded-[2.5rem] bg-paper px-6 py-10 shadow-xl md:px-16">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={offset === 0}
            aria-label="Назад"
            className="absolute left-2 top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-2xl shadow-lg transition-transform hover:scale-105 disabled:opacity-30 md:left-4"
          >
            ‹
          </button>
          <div className="overflow-hidden">
            <div
              className="flex gap-6 transition-transform duration-500 ease-out"
              style={{ transform: `translateX(calc(-${offset} * (25% + 1.5rem)))` }}
            >
              {SHOWCASE.map((item, i) => (
                <article key={item.title} className="w-40 shrink-0 text-center md:w-44">
                  <div
                    className={`flex h-28 items-center justify-center rounded-2xl ${CARD_COLORS[i % CARD_COLORS.length]}`}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="size-24 rounded-full object-cover shadow-lg"
                    />
                  </div>
                  <p className="mt-3 font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.kcal} ккал · {item.minutes} мин
                  </p>
                  <Link
                    to="/register"
                    className="mt-2 inline-flex min-h-9 items-center rounded-full bg-ink px-4 text-xs font-medium text-cream"
                  >
                    Открыть
                  </Link>
                </article>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(max, i + 1))}
            disabled={offset >= max}
            aria-label="Вперёд"
            className="absolute right-2 top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-2xl shadow-lg transition-transform hover:scale-105 disabled:opacity-30 md:right-4"
          >
            ›
          </button>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: max + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
              className={`size-2.5 rounded-full transition-colors ${i === offset ? "bg-sage-deep" : "bg-line"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Три зелёные карточки преимуществ (референс 4). */
function Features() {
  const cards = [
    {
      t: "Быстрый старт",
      d: "Регистрация, базовый набор продуктов и первый рецепт — за пять минут.",
    },
    {
      t: "Умный подбор",
      d: "Блюда ранжируются по совпадению с холодильником, с подписью, чего не хватает.",
    },
    {
      t: "Ноль отходов",
      d: "Свежесть продуктов, автосписание после готовки и аналитика сэкономленной еды.",
    },
  ];

  return (
    <section className="bg-cream px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((card, i) => (
            <article
              key={card.t}
              className={`gx-card-hover relative rounded-lg bg-sage-deep p-6 pt-10 text-cream ${i === 0 ? "gx-rise" : i === 1 ? "gx-rise-2" : "gx-rise-3"}`}
            >
              <span className="absolute -top-4 left-6 flex size-9 items-center justify-center rounded-full bg-cream text-lg text-ink">
                +
              </span>
              <h3 className="font-serif text-2xl">{card.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-cream/85">{card.d}</p>
            </article>
          ))}
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_1fr] md:items-center">
          <div>
            <h2 className="font-display text-4xl font-light leading-tight text-ink md:text-5xl">
              Кухня, которая{" "}
              <span className="text-sage-deep">считает</span>{" "}
              <span className="text-blush-deep">за вас</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              Список покупок собирается сам, свежесть продуктов подсвечивается,
              а кнопка «Я приготовил это» списывает граммовки из холодильника.
              Останется только вкусно поесть.
            </p>
            <Link
              to="/register"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-8 font-medium text-cream"
            >
              Попробовать
            </Link>
          </div>
          <img
            src="/images/fridge.jpg"
            alt="Продукты в холодильнике"
            className="h-72 w-full rounded-2xl object-cover md:h-96"
          />
        </div>
      </div>
    </section>
  );
}

/** Как это работает — 4 шага. */
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
