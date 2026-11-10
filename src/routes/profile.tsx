import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { getProfile, updateProfile, type ProfileRow } from "@/lib/kitchen-api";

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
              <Link
                to="/kitchen"
                className="mt-8 inline-flex min-h-12 items-center rounded-full bg-blush px-6 font-medium text-ink"
              >
                Перейти на кухню
              </Link>
            </section>
          </div>
        )}
      </div>
    </main>
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
