import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) return <main className="min-h-svh bg-sage" />;
  if (user) return <Navigate to="/kitchen" />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    const { error: err } = await authClient.signUp.email({
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    setBusy(false);
    if (err) {
      setError(err.message || "Не получилось создать аккаунт");
      return;
    }
    await navigate({ to: "/kitchen" });
  }

  return (
    <main className="relative min-h-svh bg-sage">
      <SiteNav />
      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-10 px-5 py-24 md:grid-cols-2 md:px-10">
        <div>
          <p className="font-serif text-lg">Первый шаг</p>
          <h1 className="mt-2 font-display text-section font-light leading-[0.85] tracking-tight text-cream">
            РЕГИСТРАЦИЯ
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink/80">
            Аккаунт сохраняется в базе: холодильник и свои рецепты не пропадут.
          </p>
        </div>
        <form onSubmit={onSubmit} className="rounded-lg bg-cream p-6 shadow-sm md:p-8">
          <Field name="name" label="Имя" type="text" placeholder="Елизавета" />
          <Field name="email" label="Email" type="email" placeholder="you@mail.ru" />
          <Field
            name="password"
            label="Пароль"
            type="password"
            placeholder="минимум 8 символов"
          />
          {error ? <p className="mt-2 text-sm text-blush-deep">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 min-h-12 w-full rounded-full bg-ink text-cream disabled:opacity-60"
          >
            {busy ? "Создаём…" : "Создать аккаунт"}
          </button>
          <p className="mt-4 text-center text-sm text-muted">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="text-ink underline">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  type,
  placeholder,
}: {
  name: string;
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required
        minLength={type === "password" ? 8 : undefined}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-md border border-line bg-paper px-4 text-base text-ink outline-none ring-ink/20 focus:ring-2"
      />
    </label>
  );
}
