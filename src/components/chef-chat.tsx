import { FormEvent, useEffect, useRef, useState } from "react";
import { assistantChat } from "@/lib/llm-api";

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Плавающий чат с шеф-ИИ: «что приготовить из того, что есть?». */
export function ChefChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Привет! Я шеф-ИИ Gastronomix. Спросите, что приготовить из вашего холодильника, или просто расскажите, чего хочется.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function onSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const history = messages.slice(-8);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const result = await assistantChat({
        data: { message: text, history: history.map((m) => ({ role: m.role, content: m.content })) },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).slice(0, 160));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-30 min-h-12 rounded-full bg-ink px-5 text-sm font-medium text-cream shadow-lg"
      >
        {open ? "Закрыть чат" : "✨ Спросить шефа"}
      </button>

      {open ? (
        <div className="fixed bottom-20 right-5 z-30 flex max-h-[70vh] w-[min(92vw,360px)] flex-col rounded-lg bg-cream shadow-xl">
          <div className="rounded-t-lg bg-ink px-4 py-3 text-cream">
            <p className="font-serif text-lg">Шеф-ИИ ✨</p>
            <p className="text-xs text-cream/70">знает ваш холодильник и каталог</p>
          </div>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <p
                key={i}
                className={`rounded-md px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "ml-8 bg-sage/50 text-ink" : "mr-4 bg-paper text-ink"
                }`}
              >
                {m.content}
              </p>
            ))}
            {busy ? <p className="mr-4 bg-paper px-3 py-2 text-sm text-muted">Шеф печатает…</p> : null}
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
          </div>
          <form onSubmit={onSend} className="flex gap-2 border-t border-line p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Например: что приготовить на ужин?"
              className="min-h-11 flex-1 rounded-md border border-line bg-paper px-3 text-sm"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={busy || draft.trim().length === 0}
              className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-cream disabled:opacity-40"
            >
              →
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
