import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  ALLERGEN_OPTIONS,
  CUISINE_OPTIONS,
  DIET_OPTIONS,
  EQUIPMENT_OPTIONS,
  getPreferences,
  savePreferences,
  type Preferences,
} from "@/lib/kitchen-api";

export const Route = createFileRoute("/preferences")({ component: PreferencesPage });

type ChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 rounded-full px-4 text-sm ${
        active ? "bg-ink text-cream" : "border border-line bg-paper text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-lg bg-paper p-6 md:p-8">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function RadioRow({
  name,
  value,
  current,
  onChange,
  label,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="size-4"
      />
      {label}
    </label>
  );
}

function PreferencesPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [stopList, setStopList] = useState<string[]>([]);
  const [stopDraft, setStopDraft] = useState("");
  const [goal, setGoal] = useState<Preferences["goal"]>("none");
  const [macro, setMacro] = useState<Preferences["macro"]>("balance");
  const [dailyKcal, setDailyKcal] = useState("");
  const [maxMinutes, setMaxMinutes] = useState("");
  const [skill, setSkill] = useState<Preferences["skill"]>("novice");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [spice, setSpice] = useState<Preferences["spice"]>("any");
  const [portionsMode, setPortionsMode] = useState<Preferences["portionsMode"]>("single");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setAllergens(prefs.allergens);
        setDiets(prefs.diets);
        setStopList(prefs.stopList);
        setGoal(prefs.goal);
        setMacro(prefs.macro);
        if (prefs.dailyKcal) setDailyKcal(String(prefs.dailyKcal));
        if (prefs.maxMinutes) setMaxMinutes(String(prefs.maxMinutes));
        setSkill(prefs.skill);
        setEquipment(prefs.equipment);
        setCuisines(prefs.cuisines);
        setSpice(prefs.spice);
        setPortionsMode(prefs.portionsMode);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isPending) return <main className="min-h-svh bg-cream" />;
  if (!user) return <RedirectToSignIn />;

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await savePreferences({
        data: {
          allergens,
          diets,
          stopList,
          goal,
          macro,
          dailyKcal: dailyKcal ? Number(dailyKcal) : null,
          maxMinutes: maxMinutes ? Number(maxMinutes) : null,
          skill,
          equipment,
          cuisines,
          spice,
          portionsMode,
        },
      });
      await navigate({ to: "/kitchen" });
    } catch {
      setError("Не удалось сохранить предпочтения. Попробуйте ещё раз.");
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
        <Link
          to="/kitchen"
          className="min-h-11 rounded-full bg-cream px-4 py-2 text-sm text-ink"
        >
          Пропустить
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-5 pb-20">
        <h1 className="pt-10 font-display text-5xl font-light tracking-tight text-sage-deep md:text-7xl">
          ВАШИ ПРЕДПОЧТЕНИЯ
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Настройте приложение под себя. Жёсткие ограничения скроют неподходящие
          блюда, мягкие — расставят подходящие наверху. Всё можно изменить позже
          в профиле.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Загружаем настройки…</p>
        ) : (
          <form onSubmit={onSubmit}>
            <Section
              title="Аллергены и непереносимость"
              subtitle="Жёсткий фильтр: блюда с этими продуктами не попадут в выдачу"
            >
              <div className="flex flex-wrap gap-2">
                {ALLERGEN_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option.charAt(0).toUpperCase() + option.slice(1)}
                    active={allergens.includes(option)}
                    onClick={() => toggle(allergens, setAllergens, option)}
                  />
                ))}
              </div>
            </Section>

            <Section
              title="Тип питания и диеты"
              subtitle="Жёсткий фильтр: типичные запрещённые продукты будут исключены"
            >
              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option.charAt(0).toUpperCase() + option.slice(1)}
                    active={diets.includes(option)}
                    onClick={() => toggle(diets, setDiets, option)}
                  />
                ))}
              </div>
            </Section>

            <Section
              title="Стоп-лист продуктов"
              subtitle="Ингредиенты, которые вы не едите по вкусу: кинза, лук, оливки…"
            >
              <div className="flex gap-2">
                <input
                  value={stopDraft}
                  onChange={(e) => setStopDraft(e.target.value)}
                  className="min-h-11 flex-1 rounded-md border border-line bg-cream px-3 text-sm"
                  placeholder="Например: кинза"
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = stopDraft.trim().toLowerCase();
                    if (value && !stopList.includes(value)) setStopList([...stopList, value]);
                    setStopDraft("");
                  }}
                  className="min-h-11 rounded-full bg-ink px-5 text-sm text-cream"
                >
                  Добавить
                </button>
              </div>
              {stopList.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {stopList.map((item) => (
                    <Chip
                      key={item}
                      label={`${item} ×`}
                      active
                      onClick={() => setStopList(stopList.filter((v) => v !== item))}
                    />
                  ))}
                </div>
              ) : null}
            </Section>

            <Section
              title="Цели по КБЖУ и здоровью"
              subtitle="Мягкая настройка: блюда под цель поднимаются выше в выдаче"
            >
              <div className="grid gap-1 sm:grid-cols-2">
                <RadioRow name="goal" value="none" current={goal} onChange={(v) => setGoal(v as Preferences["goal"])} label="Без цели" />
                <RadioRow name="goal" value="lose" current={goal} onChange={(v) => setGoal(v as Preferences["goal"])} label="Дефицит калорий (похудение)" />
                <RadioRow name="goal" value="gain" current={goal} onChange={(v) => setGoal(v as Preferences["goal"])} label="Профицит (набор массы)" />
                <RadioRow name="goal" value="gi" current={goal} onChange={(v) => setGoal(v as Preferences["goal"])} label="Контроль гликемического индекса" />
              </div>

              <p className="mt-6 text-sm font-medium">Баланс БЖУ</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                <RadioRow name="macro" value="balance" current={macro} onChange={(v) => setMacro(v as Preferences["macro"])} label="Сбалансированный" />
                <RadioRow name="macro" value="protein" current={macro} onChange={(v) => setMacro(v as Preferences["macro"])} label="Больше белка" />
                <RadioRow name="macro" value="lowfat" current={macro} onChange={(v) => setMacro(v as Preferences["macro"])} label="Меньше жиров" />
                <RadioRow name="macro" value="lowcarb" current={macro} onChange={(v) => setMacro(v as Preferences["macro"])} label="Меньше углеводов" />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Суточная норма калорий
                  <input
                    type="number"
                    min={800}
                    max={6000}
                    value={dailyKcal}
                    onChange={(e) => setDailyKcal(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-cream px-3"
                    placeholder="Например: 2000"
                  />
                </label>
                <label className="block text-sm">
                  Максимум времени на блюдо
                  <select
                    value={maxMinutes}
                    onChange={(e) => setMaxMinutes(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-md border border-line bg-cream px-3"
                  >
                    <option value="">Любое</option>
                    <option value="20">до 20 минут в будни</option>
                    <option value="30">до 30 минут</option>
                    <option value="45">до 45 минут</option>
                    <option value="60">до 60 минут</option>
                  </select>
                </label>
              </div>
            </Section>

            <Section
              title="Параметры готовки"
              subtitle="Влияют на порядок и подсказки в подборе"
            >
              <div className="grid gap-1 sm:grid-cols-2">
                <RadioRow name="skill" value="novice" current={skill} onChange={(v) => setSkill(v as Preferences["skill"])} label="Новичок — простые блюда в приоритете" />
                <RadioRow name="skill" value="chef" current={skill} onChange={(v) => setSkill(v as Preferences["skill"])} label="Шеф — не ограничивайте сложность" />
              </div>

              <p className="mt-6 text-sm font-medium">Доступная техника</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option.charAt(0).toUpperCase() + option.slice(1)}
                    active={equipment.includes(option)}
                    onClick={() => toggle(equipment, setEquipment, option)}
                  />
                ))}
              </div>
            </Section>

            <Section
              title="Кулинарные предпочтения"
              subtitle="Любимые кухни, острота и размер порций"
            >
              <p className="text-sm font-medium">Кухни мира</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option.charAt(0).toUpperCase() + option.slice(1)}
                    active={cuisines.includes(option)}
                    onClick={() => toggle(cuisines, setCuisines, option)}
                  />
                ))}
              </div>

              <div className="mt-6 grid gap-1 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Острота</p>
                  <div className="mt-2">
                    <RadioRow name="spice" value="any" current={spice} onChange={(v) => setSpice(v as Preferences["spice"])} label="Как получится" />
                    <RadioRow name="spice" value="mild" current={spice} onChange={(v) => setSpice(v as Preferences["spice"])} label="Не остро" />
                    <RadioRow name="spice" value="hot" current={spice} onChange={(v) => setSpice(v as Preferences["spice"])} label="Люблю поострее" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Порции</p>
                  <div className="mt-2">
                    <RadioRow name="portions" value="single" current={portionsMode} onChange={(v) => setPortionsMode(v as Preferences["portionsMode"])} label="Готовлю на одного" />
                    <RadioRow name="portions" value="family" current={portionsMode} onChange={(v) => setPortionsMode(v as Preferences["portionsMode"])} label="Готовлю на семью" />
                  </div>
                </div>
              </div>
            </Section>

            {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={busy}
                className="min-h-12 rounded-full bg-ink px-8 font-medium text-cream disabled:opacity-40"
              >
                {busy ? "Сохраняем…" : "Сохранить и открыть кухню"}
              </button>
              <Link to="/kitchen" className="text-sm text-muted underline">
                Продолжить без настроек
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
