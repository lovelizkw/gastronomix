import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="bg-cream text-ink">
      <Hero />
      <What />
      <History />
      <How />
      <Invite />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-sage">
      <SiteNav />
      <div className="relative grid min-h-[100svh] grid-cols-1 md:grid-cols-2">
        <div className="relative flex flex-col justify-end px-5 pb-28 pt-24 md:px-10 md:pb-32">
          <span className="mb-6 inline-flex size-10 items-center justify-center rounded-full bg-lilac text-[10px] font-semibold tracking-widest text-ink">
            GX
          </span>
          <p className="max-w-xs font-serif text-lead leading-tight text-ink">
            Учёт продуктов
            <br />
            и феномен
            <br />
            умного рациона
          </p>
        </div>
        <div className="relative min-h-[42vh] md:min-h-full">
          <img
            src="/images/hero-tomatoes.jpg"
            alt="Свежие томаты"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      </div>

      <h1 className="pointer-events-none absolute left-0 right-0 top-[10%] z-[1] px-3 font-display text-display font-light leading-[0.78] tracking-tight text-cream md:top-[8%] md:px-5">
        GASTRO
        <br />
        NOMIX
      </h1>

      <img
        src="/images/whisk-bowl.jpg"
        alt=""
        className="pointer-events-none absolute right-[42%] top-[8%] z-[2] hidden size-32 rounded-full object-cover shadow-lg md:block lg:size-40"
      />

      <Link
        to="/register"
        className="absolute bottom-10 left-1/2 z-20 flex size-28 -translate-x-1/2 items-center justify-center rounded-full bg-blush font-serif text-lg text-ink shadow-sm transition-transform duration-200 hover:scale-105 md:bottom-16 md:left-[46%] md:size-32"
      >
        Узнать
      </Link>
    </section>
  );
}

function What() {
  return (
    <section className="relative overflow-hidden bg-cream px-5 py-20 md:px-12 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-start">
        <h2 className="font-display text-section font-light leading-[0.85] tracking-tight text-sage-deep">
          ЧТО
          <br />
          ЭТО
          <br />
          ТАКОЕ?
        </h2>
        <div className="space-y-8 pt-2">
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Цифровой холодильник. Вы записываете, что есть дома — система
            предлагает блюда из этих продуктов и считает КБЖУ.
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Ничего сложного: честный подбор по ингредиентам,
            понятный интерфейс и аккуратный журнал о еде.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-4 md:mt-20 md:grid-cols-3 md:gap-6">
        <img
          src="/images/soup-cup.jpg"
          alt="Крем-суп"
          className="col-start-1 row-start-2 aspect-square w-28 rounded-sm object-cover md:row-start-1 md:mt-24 md:w-40"
        />
        <img
          src="/images/green-spoon.jpg"
          alt="Зелень"
          className="col-start-2 aspect-[4/3] w-full object-cover md:col-start-2 md:row-start-1"
        />
        <img
          src="/images/paprika.jpg"
          alt="Специи"
          className="col-start-1 row-start-1 aspect-[4/3] w-full object-cover md:col-start-3"
        />
      </div>

      <p className="mx-auto mt-12 max-w-md text-center text-sm leading-relaxed text-muted md:mt-16">
        Сегодня еда считается слишком сложной. На самом деле достаточно знать,
        что лежит на полке — и{" "}
        <span className="rounded-full bg-sage px-2 py-0.5 text-ink">готовить из этого</span>
        .
      </p>
    </section>
  );
}

function History() {
  return (
    <section className="relative overflow-hidden bg-lilac px-5 py-20 text-ink md:px-12 md:py-28">
      <p className="mb-4 text-center font-serif text-5xl text-lilac-deep md:text-7xl">食</p>
      <h2 className="text-center font-display text-section font-light leading-[0.85] tracking-tight text-cream">
        НЕМНОГО
        <br />
        ИСТОРИИ
      </h2>

      <img
        src="/images/print-woman.jpg"
        alt="Гравюра"
        className="absolute right-4 top-28 hidden w-36 md:block lg:right-16 lg:w-48"
      />

      <div className="mx-auto mt-16 grid max-w-6xl gap-10 md:grid-cols-2 md:items-end">
        <div>
          <p className="font-display text-4xl font-light tracking-tight text-cream md:text-5xl">
            В КУХНЕ
          </p>
          <img
            src="/images/green-spoon.jpg"
            alt=""
            className="mt-3 mb-6 size-14 rounded-full object-cover"
          />
          <p className="max-w-md text-sm leading-relaxed text-ink/80">
            Люди веками учились не выбрасывать еду: из остатков получался бульон,
            из вчерашнего хлеба — гренки. Gastronomix переносит этот ритуал в
            телефон и браузер — без пафоса, с калориями.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink/80">
            Мы начинаем с простого: список продуктов, подбор рецептов, КБЖУ на
            порцию. Остальное — позже.
          </p>
        </div>
        <img
          src="/images/print-scholar.jpg"
          alt="Старинная гравюра"
          className="w-full max-w-md justify-self-end object-cover"
        />
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <img
          src="/images/print-table.jpg"
          alt="Трапеза"
          className="w-full object-cover"
        />
        <div className="pb-2">
          <p className="font-display text-5xl font-light text-cream">РАЦИОН</p>
          <p className="mt-4 text-sm leading-relaxed text-ink/80">
            Не диета и не медицинский совет. Просто ясность: что есть дома и что
            из этого можно собрать сегодня вечером.
          </p>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: "01", t: "Регистрация", d: "Имя, почта, пароль. Сессия хранится в браузере." },
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
    <section className="bg-sage px-5 py-24 text-center md:py-32">
      <h2 className="mx-auto mt-4 max-w-3xl font-display text-section font-light leading-[0.85] tracking-tight text-cream">
        ЗАЙДИТЕ
        <br />
        НА КУХНЮ
      </h2>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/register"
          className="flex min-h-12 items-center rounded-full bg-blush px-8 py-3 font-medium text-ink"
        >
          Создать аккаунт
        </Link>
        <Link
          to="/login"
          className="flex min-h-12 items-center rounded-full border border-ink/20 px-8 py-3 font-medium text-ink"
        >
          Войти
        </Link>
      </div>
    </section>
  );
}
