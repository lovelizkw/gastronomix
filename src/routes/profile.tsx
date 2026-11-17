import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import {
  getPreferences,
  getProfile,
  getWeekKbju,
  getWasteStats,
  updateProfile,
  type KbjuDay,
  type Preferences,
  type ProfileRow,
  type WasteStats,
} from "@/lib/kitchen-api";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function formatDate(value: string): string {
  // Postgres/PGLite отдают timestamp текстом вида "2026-11-10 01:26:48+04".
  // Берём только дату — так формат не зависит от часового пояса и диалекта.
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [waste, setWaste] = useState<WasteStats | null>(null);
  const [week, setWeek] = useState<KbjuDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getProfile()
      .then((row) => {
        if (cancelled || !row) return;
        setProfile(row);
        setName(row.name);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getPreferences()
      .then((row) => {
        if (!cancelled) setPrefs(row);
      })
      .catch(() => null);
    getWasteStats()
      .then((row) => {
        if (!cancelled) setWaste(row);
      })
      .catch(() => null);
    getWeekKbju()
      .then((rows) => {
        if (!cancelled) setWeek(rows);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const row = await updateProfile({ data: { name: name.trim() } });
      if (row) {
        setProfile((prev) => (prev ? { ...prev, name: row.name } : prev));
        setMessage("Имя сохранено");
      }
    } catch {
      setError("Не удалось сохранить имя");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-cream">
      <header className="flex items-center justify-between bg-ink px-5 py-4 text-cream">
        <Link to="/" className="font-display text-sm tracking-[0.28em] uppercase">
          Gastronomix
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/kitchen"
            className="min-h-11 rounded-full border border-cream/40 px-4 py-2 text-cream"
          >
            Кухня
          </Link>
          <Link to="/profile" className="min-h-11 rounded-full bg-cream px-4 py-2 text-ink">
            Профиль
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
          ПРОФИЛЬ
        </h1>
        <p className="mt-2 text-sm text-muted">Личные данные и статистика вашей кухни.</p>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Загружаем профиль…</p>
        ) : !profile ? (
          <div className="mt-8 border border-dashed border-line px-6 py-16 text-center">
            <p className="font-serif text-3xl">Профиль недоступен</p>
          </div>
        ) : (
          <>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <section className="rounded-lg bg-paper p-6 md:p-8">
              <h2 className="font-serif text-2xl">Данные аккаунта</h2>
              <p className="mt-1 text-sm text-muted">{profile.email}</p>
              <p className="mt-1 text-sm text-muted">
                На Gastronomix с {formatDate(profile.createdAt)}
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <label className="block text-sm">
                  Имя
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={60}
                    className="mt-2 min-h-12 w-full rounded-md border border-line bg-cream px-4"
                  />
                </label>
                {message ? <p className="text-sm text-sage-deep">{message}</p> : null}
                {error ? <p className="text-sm text-red-700">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy || name.trim().length < 2}
                  className="min-h-12 rounded-full bg-ink px-8 text-cream disabled:opacity-40"
                >
                  {busy ? "Сохраняем…" : "Сохранить"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => void signOut("/")}
                className="mt-8 min-h-11 text-sm text-muted underline"
              >
                Выйти из аккаунта
              </button>
            </section>

            <section className="rounded-lg bg-paper p-6 md:p-8">
              <h2 className="font-serif text-2xl">Ваша коллекция</h2>
              <dl className="mt-6 grid gap-4">
                <Stat label="Своих рецептов" value={profile.recipes} />
                <Stat label="Продуктов в холодильнике" value={profile.products} />
                <Stat label="Рецептов в избранном" value={profile.favorites} />
              </dl>

              <div className="mt-8 border-t border-line pt-6">
                <h3 className="font-serif text-xl">Предпочтения</h3>
                {prefs && (prefs.allergens.length > 0 || prefs.diets.length > 0 || prefs.stopList.length > 0) ? (
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {prefs.allergens.length > 0 ? (
                      <li>Аллергены: {prefs.allergens.join(", ")}</li>
                    ) : null}
                    {prefs.diets.length > 0 ? (
                      <li>Диеты: {prefs.diets.join(", ")}</li>
                    ) : null}
                    {prefs.stopList.length > 0 ? (
                      <li>Стоп-лист: {prefs.stopList.join(", ")}</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Ограничения не настроены — выдача показывает все блюда.
                  </p>
                )}
                <Link
                  to="/preferences"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line bg-cream px-5 text-sm font-medium text-ink"
                >
                  Изменить предпочтения
                </Link>
              </div>

              <Link
                to="/kitchen"
                className="mt-6 inline-flex min-h-12 items-center rounded-full bg-blush px-6 font-medium text-ink"
              >
                Перейти на кухню
              </Link>
            </section>
          </div>

          {waste ? (
            <section className="mt-8 rounded-lg bg-paper p-6 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl">Ноль отходов</h2>
                  <p className="mt-1 text-sm text-muted">Ваша еда за последний месяц.</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-5xl font-light text-sage-deep">
                    {waste.zeroWasteScore}
                  </p>
                  <p className="text-xs text-muted">индекс из 100</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div className="rounded-lg bg-cream p-5">
                  <p className="text-xs uppercase tracking-wide text-muted">Спасено продуктов</p>
                  <p className="mt-2 font-display text-4xl font-light text-sage-deep">
                    {(waste.cookedGrams / 1000).toFixed(1)} кг
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    ≈ {waste.savedMoney.toLocaleString("ru-RU")} ₽ сэкономлено
                  </p>
                </div>
                <div className="rounded-lg bg-cream p-5">
                  <p className="text-xs uppercase tracking-wide text-muted">Выброшено</p>
                  <p className="mt-2 font-display text-4xl font-light text-blush-deep">
                    {(waste.discardedGrams / 1000).toFixed(1)} кг
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    готовьте вовремя — и это число уменьшится
                  </p>
                </div>
                <div className="rounded-lg bg-cream p-5">
                  <p className="text-xs uppercase tracking-wide text-muted">Как считаем</p>
                  <p className="mt-2 text-sm text-muted">
                    «Спасено» — продукты, списанные кнопкой «Я приготовил это».
                    Деньги — оценка 300 ₽ за кг.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="font-serif text-xl">КБЖУ за неделю</h3>
                  {week.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">
                      Готовьте по рецептам — здесь появится график.
                    </p>
                  ) : (
                    <div className="mt-4 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={week}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1c191712" />
                          <XAxis
                            dataKey="day"
                            tickFormatter={(v: string) => v.slice(5)}
                            fontSize={11}
                          />
                          <YAxis fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="k" name="Ккал" fill="#7e9854" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="b" name="Белки, г" fill="#8e88c0" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="j" name="Жиры, г" fill="#e8a39d" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="u" name="Углеводы, г" fill="#c5c0e3" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="font-serif text-lg">Чаще покупаете</h3>
                    <TopList items={waste.topBought} empty="Пока нет покупок." />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg">Чаще выбрасываете</h3>
                    <TopList items={waste.topDiscarded} empty="Ничего не выбрасывали." />
                  </div>
                </div>
              </div>
            </section>
          ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function TopList({
  items,
  empty,
}: {
  items: { name: string; grams: number }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">{empty}</p>;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.name} className="flex items-baseline justify-between gap-3 text-sm">
          <span>{item.name}</span>
          <span className="text-muted">{(item.grams / 1000).toFixed(1)} кг</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-display text-3xl font-light text-sage-deep">{value}</dd>
    </div>
  );
}
