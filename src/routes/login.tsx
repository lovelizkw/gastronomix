import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { SiteNav } from "@/components/site-nav";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return <main className="min-h-svh bg-lilac" />;
  }
  if (user) {
    return <Navigate to="/kitchen" />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const { error: err } = await authClient.signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    setBusy(false);
    if (err) {
      setError(err.message || "Неверный email или пароль");
      return;
    }
    await navigate({ to: "/kitchen" });
  }

  return (
    <main className="relative min-h-svh bg-lilac">
      <SiteNav />
      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-10 px-5 py-24 md:grid-cols-2 md:px-10">
        <div>
          <p className="font-serif text-lg">С возвращением</p>
          <h1 className="mt-2 font-display text-section font-light leading-[0.85] tracking-tight text-cream">
            ВХОД
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink/80">
            Войдите, чтобы открыть холодильник, каталог рецептов и свои блюда.
          </p>
        </div>
        <div className="rounded-lg bg-cream p-6 shadow-sm md:p-8">
          {authEnabled ? (
            <div className="mb-6 grid gap-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => signIn(p.providerId, { callbackURL: "/kitchen" })}
                  className="min-h-12 w-full rounded-full border border-line bg-paper font-medium"
                >
                  Войти через {p.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">Вход отключён.</p>
          )}
          <form onSubmit={onSubmit}>
            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input
                name="email"
                type="email"
                required
                className="min-h-12 w-full rounded-md border border-line bg-paper px-4 text-base outline-none ring-ink/20 focus:ring-2"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium">Пароль</span>
              <input
                name="password"
                type="password"
                required
                className="min-h-12 w-full rounded-md border border-line bg-paper px-4 text-base outline-none ring-ink/20 focus:ring-2"
              />
            </label>
            {error ? <p className="mt-2 text-sm text-blush-deep">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-6 min-h-12 w-full rounded-full bg-ink text-cream disabled:opacity-60"
            >
              {busy ? "Входим…" : "Войти"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            Нет аккаунта?{" "}
            <Link to="/register" className="text-ink underline">
              Регистрация
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
