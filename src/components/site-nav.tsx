import { Link } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function SiteNav({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { isPending } = useCurrentUserState();
  const ink = tone === "dark";

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-8">
      <Link
        to="/"
        className={`font-display text-sm tracking-[0.28em] uppercase ${ink ? "text-cream" : "text-ink"}`}
      >
        Gastronomix
      </Link>
      <nav className="flex min-h-11 items-center gap-3 text-sm font-medium">
        {isPending ? (
          <div className="h-8 w-24 animate-pulse rounded-full bg-ink/10" />
        ) : (
          <>
            <SignedIn>
              <Link
                to="/kitchen"
                className={`min-h-11 rounded-full px-5 py-2 ${ink ? "bg-cream text-ink" : "bg-ink text-cream"}`}
              >
                Кухня
              </Link>
            </SignedIn>
            <SignedOut>
              <Link
                to="/login"
                className={`hidden min-h-11 items-center sm:flex ${ink ? "text-cream" : "text-ink"}`}
              >
                Войти
              </Link>
              <Link
                to="/register"
                className={`flex min-h-11 items-center rounded-full px-5 py-2 ${ink ? "bg-blush text-ink" : "bg-ink text-cream"}`}
              >
                Начать
              </Link>
            </SignedOut>
          </>
        )}
      </nav>
    </header>
  );
}

export function KitchenUser() {
  return (
    <div className="text-cream [&_button]:text-cream [&_span]:text-cream">
      <UserButton />
    </div>
  );
}
