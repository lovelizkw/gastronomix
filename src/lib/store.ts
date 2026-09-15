import { create } from "zustand";

export type Product = {
  id: string;
  name: string;
  category: string;
  qty: string;
};

export type Session = {
  name: string;
  email: string;
};

type UserRecord = Session & { password: string };

const USERS_KEY = "gastronomix_users";
const SESSION_KEY = "gastronomix_session";
const PRODUCTS_KEY = "gastronomix_products";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

type State = {
  session: Session | null;
  products: Product[];
  hydrated: boolean;
  hydrate: () => void;
  register: (input: { name: string; email: string; password: string }) => string | null;
  login: (input: { email: string; password: string }) => string | null;
  logout: () => void;
  addProduct: (input: { name: string; category: string; qty: string }) => void;
  removeProduct: (id: string) => void;
};

export const useKitchen = create<State>((set, get) => ({
  session: null,
  products: [],
  hydrated: false,

  hydrate: () => {
    const session = readJson<Session | null>(SESSION_KEY, null);
    const all = readJson<Record<string, Product[]>>(PRODUCTS_KEY, {});
    set({
      session,
      products: session ? (all[session.email] ?? []) : [],
      hydrated: true,
    });
  },

  register: ({ name, email, password }) => {
    const users = readJson<UserRecord[]>(USERS_KEY, []);
    const key = email.trim().toLowerCase();
    if (users.some((u) => u.email === key)) {
      return "Пользователь с таким email уже есть";
    }
    const user: UserRecord = { name: name.trim(), email: key, password };
    writeJson(USERS_KEY, [...users, user]);
    const session = { name: user.name, email: user.email };
    writeJson(SESSION_KEY, session);
    const all = readJson<Record<string, Product[]>>(PRODUCTS_KEY, {});
    set({ session, products: all[key] ?? [] });
    return null;
  },

  login: ({ email, password }) => {
    const users = readJson<UserRecord[]>(USERS_KEY, []);
    const key = email.trim().toLowerCase();
    const user = users.find((u) => u.email === key && u.password === password);
    if (!user) return "Неверный email или пароль";
    const session = { name: user.name, email: user.email };
    writeJson(SESSION_KEY, session);
    const all = readJson<Record<string, Product[]>>(PRODUCTS_KEY, {});
    set({ session, products: all[key] ?? [] });
    return null;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ session: null, products: [] });
  },

  addProduct: ({ name, category, qty }) => {
    const session = get().session;
    if (!session) return;
    const product: Product = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category: category.trim() || "Без категории",
      qty: qty.trim(),
    };
    const next = [...get().products, product];
    const all = readJson<Record<string, Product[]>>(PRODUCTS_KEY, {});
    all[session.email] = next;
    writeJson(PRODUCTS_KEY, all);
    set({ products: next });
  },

  removeProduct: (id) => {
    const session = get().session;
    if (!session) return;
    const next = get().products.filter((p) => p.id !== id);
    const all = readJson<Record<string, Product[]>>(PRODUCTS_KEY, {});
    all[session.email] = next;
    writeJson(PRODUCTS_KEY, all);
    set({ products: next });
  },
}));
