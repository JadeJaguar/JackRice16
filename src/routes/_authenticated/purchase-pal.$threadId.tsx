import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Heart, ImagePlus, Menu, MessageCircle, PanelRight, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinance } from "@/components/finance/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { Tables } from "@/integrations/supabase/types";

type Thread = Tables<"purchase_threads">;
type Saved = Tables<"saved_items">;
type MessagePart = { type: "text"; text: string } | { type: "file" | "image"; url: string; mediaType?: string; filename?: string };
type ChatMessage = { id: string; role: "user" | "assistant"; parts: MessagePart[] };

const API_URL = import.meta.env["VITE_API_URL"] || "http://localhost:3000";

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const Route = createFileRoute("/_authenticated/purchase-pal/$threadId")({
  component: PurchasePal,
  head: () => ({
    meta: [
      { title: "Purchase Pal — Buy or Bye" },
      { name: "description", content: "Talk through a purchase with your budget-aware assistant and decide with confidence." },
      { property: "og:title", content: "Purchase Pal — Buy or Bye" },
      { property: "og:description", content: "Talk through a purchase with your budget-aware assistant and decide with confidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PurchasePal() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const { budget, categories, transactions } = useFinance();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [query, setQuery] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [mobileThreads, setMobileThreads] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mobileSaved, setMobileSaved] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const [{ data: ts }, { data: ms }, { data: si }] = await Promise.all([
      supabase.from("purchase_threads").select("*").eq("user_id", userId ?? "").order("updated_at", { ascending: false }),
      supabase.from("purchase_messages").select("*").eq("thread_id", threadId).order("created_at"),
      supabase.from("saved_items").select("*").eq("user_id", userId ?? "").order("created_at", { ascending: false }),
    ]);
    setThreads(ts ?? []);
    setSaved(si ?? []);
    const paths = (si ?? []).map((s) => s.photo_path).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("saved-item-photos")
        .createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        const key = paths[i];
        if (key && s.signedUrl) map[key] = s.signedUrl;
      });
      setPhotoUrls(map);
    } else {
      setPhotoUrls({});
    }
    setMessages(
      (ms ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: (m.parts ?? []) as unknown as MessagePart[],
      }))
    );
  };

  useEffect(() => {
    setLoaded(false);
    setChatError(null);
    void load().then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const create = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("purchase_threads")
      .insert({ user_id: u.user.id, title: "New purchase thought" })
      .select()
      .single();
    if (data) void navigate({ to: "/purchase-pal/$threadId", params: { threadId: data.id } });
  };

  const buildContext = (history: ChatMessage[]) => {
    const spent = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const totalTarget = Number(budget?.target_amount ?? categories.reduce((s, c) => s + Number(c.target_amount), 0));
    const remaining = Math.max(totalTarget - spent, 0);
    const categoryLines = categories.map((c) => {
      const used = transactions.filter((t) => t.category_id === c.id).reduce((s, t) => s + Number(t.amount), 0);
      const target = Number(c.target_amount);
      return `- ${c.name}: $${used.toFixed(0)} of $${target.toFixed(0)} spent ($${Math.max(target - used, 0).toFixed(0)} left)`;
    });
    const transcript = history
      .slice(-12)
      .map((m) => `${m.role === "user" ? "User" : "Pal"}: ${m.parts.filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text").map((p) => p.text).join(" ")}`)
      .filter((line) => !line.endsWith(": "))
      .join("\n");

    return [
      "You are Purchase Pal, a calm, non-judgmental shopping consultant inside Buy or Bye. Help the user think through a possible purchase.",
      "Use their monthly plan and recent spending to ground your advice. Be warm, concise, and encouraging. Never shame spending.",
      "",
      `Monthly plan: $${totalTarget.toFixed(0)}. Spent so far: $${spent.toFixed(0)}. Remaining: $${remaining.toFixed(0)}.`,
      "Category budgets:",
      ...categoryLines,
      "",
      "Always start by naming the item and the single best-matching category above (say 'closest match' if none fit well), then show that category's remaining budget.",
      "When the user shares a photo, briefly say what you see: the product, brand if visible, and any price shown.",
      "Then ask one or two useful follow-up questions with short advice on why they matter. Finish with a clear recommendation: buy now, wait, or save it to the heart list, with one sentence of reasoning. Keep replies under three short paragraphs.",
      "",
      "Conversation so far:",
      transcript || "(nothing yet)",
    ].join("\n");
  };

  const submit = async ({ text, files }: { text: string; files: { type: string; url: string; mediaType?: string; filename?: string }[] }) => {
    if (!text.trim() && !files.length && !photo) return;
    setChatError(null);
    let userParts: MessagePart[] = text.trim() ? [{ type: "text", text: text.trim() }] : [];
    let imageDataUrl: string | undefined;

    if (photo) {
      imageDataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(photo);
      });
      userParts = [...userParts, { type: "file", mediaType: photo.type, url: imageDataUrl, filename: photo.name }];
    } else if (files.length) {
      userParts = [...userParts, ...(files as MessagePart[])];
      imageDataUrl = files.find((f) => f.type === "file" && f.url.startsWith("data:image"))?.url;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const isFirstMessage = messages.length === 0;
    const { data: inserted } = await supabase
      .from("purchase_messages")
      .insert({ thread_id: threadId, user_id: userData.user.id, role: "user", parts: userParts as any })
      .select()
      .single();

    const history = [...messages, ...(inserted ? [{ id: inserted.id, role: "user" as const, parts: userParts }] : [])];
    setMessages(history);
    setPhoto(null);
    setSending(true);

    try {
      const result = await authedFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: buildContext(history),
          imageDataUrl,
        }),
      });
      const reply = String(result.reply ?? "").trim();
      if (reply) {
        await supabase.from("purchase_messages").insert({
          thread_id: threadId,
          user_id: userData.user.id,
          role: "assistant",
          parts: [{ type: "text", text: reply }] as any,
        });
      }
      if (isFirstMessage) {
        const thread = threads.find((t) => t.id === threadId);
        if (!thread?.title || thread.title === "New purchase thought") {
          const title = itemName(text.trim());
          if (title) await supabase.from("purchase_threads").update({ title }).eq("id", threadId).eq("user_id", userData.user.id);
        }
      }
      await load();
    } catch (err) {
      console.error("[purchase-pal] chat error", err);
      const message = err instanceof Error ? err.message : String(err);
      setChatError(/429|rate limit/i.test(message) ? "Your Pal needs a short pause. Please try again soon." : "I couldn't complete that thought. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const existingSaved = saved.find((s) => s.thread_id === threadId);

  const saveItem = async () => {
    const alreadySaved = !!existingSaved;
    if (alreadySaved) {
      await removeSavedItem(existingSaved.id, existingSaved.photo_path);
      return;
    }

    const reversed = [...messages].reverse();
    const userMessage = reversed.find((m) => m.role === "user");
    const userText = userMessage?.parts?.find((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text");
    const assistantMessage = reversed.find((m) => m.role === "assistant");
    const assistantText = assistantMessage?.parts?.find((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text");
    if (!userText && !assistantText) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const imagePart = reversed
      .flatMap((m) => m.parts)
      .find((p): p is Extract<MessagePart, { type: "file" | "image" }> => (p.type === "file" || p.type === "image") && p.url.startsWith("data:image"));

    let photoPath: string | null = null;
    if (imagePart) {
      try {
        const blob = await (await fetch(imagePart.url)).blob();
        const ext = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
        const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("saved-item-photos")
          .upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (upErr) console.error("[purchase-pal] photo save failed", upErr);
        else photoPath = path;
      } catch (err) {
        console.error("[purchase-pal] photo save failed", err);
      }
    }

    await supabase.from("saved_items").insert({
      user_id: u.user.id,
      thread_id: threadId,
      name: itemName(String(userText?.text ?? "")) || "Saved item",
      notes: recommendationSummary(assistantText?.text ?? userText?.text ?? ""),
      photo_path: photoPath,
    });
    void load();
  };

  const removeSavedItem = async (id: string, photoPath: string | null) => {
    await supabase.from("saved_items").delete().eq("id", id);
    if (photoPath) {
      const { error } = await supabase.storage.from("saved-item-photos").remove([photoPath]);
      if (error) console.error("[purchase-pal] saved item photo delete failed", error);
    }
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from("purchase_messages").delete().eq("thread_id", id);
    await supabase.from("purchase_threads").delete().eq("id", id);
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === threadId) {
      if (remaining[0]) {
        void navigate({ to: "/purchase-pal/$threadId", params: { threadId: remaining[0].id } });
      } else {
        void create();
      }
    }
  };

  const removeMany = async (ids: string[]) => {
    if (!ids.length) return;
    await supabase.from("purchase_messages").delete().in("thread_id", ids);
    await supabase.from("purchase_threads").delete().in("id", ids);
    const remaining = threads.filter((t) => !ids.includes(t.id));
    setThreads(remaining);
    setSelected(new Set());
    setSelecting(false);
    if (ids.includes(threadId)) {
      if (remaining[0]) {
        void navigate({ to: "/purchase-pal/$threadId", params: { threadId: remaining[0].id } });
      } else {
        void create();
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = threads.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));

  if (!loaded) return <div className="glass-card h-[70vh] animate-pulse" />;

  return (
    <div className="relative -mx-1 grid h-[calc(100vh-10rem)] min-h-[620px] overflow-hidden rounded-3xl border border-white/70 bg-white/65 shadow-xl backdrop-blur-xl lg:grid-cols-[270px_1fr_290px]">
      <aside
        className={`${
          mobileThreads ? "absolute inset-y-0 left-0 z-30 flex w-72" : "hidden"
        } flex-col overflow-hidden border-r bg-background/95 p-4 lg:flex`}
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="font-display text-lg font-bold">Conversations</h2>
          <div className="flex items-center gap-1">
            {threads.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelecting((s) => !s);
                  setSelected(new Set());
                }}
              >
                {selecting ? "Done" : "Select"}
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => setMobileThreads(false)} className="lg:hidden">
              <X />
            </Button>
          </div>
        </div>
        {selecting ? (
          <div className="mt-4 flex shrink-0 items-center gap-2">
            <Button
              className="flex-1"
              variant="destructive"
              disabled={selected.size === 0}
              onClick={() => void removeMany([...selected])}
            >
              <Trash2 />
              Delete {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected((prev) =>
                  prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))
                )
              }
            >
              {selected.size === filtered.length && filtered.length > 0 ? "None" : "All"}
            </Button>
          </div>
        ) : (
          <Button className="mt-4 shrink-0" variant="soft" onClick={() => void create()}>
            <Plus />
            New conversation
          </Button>
        )}
        <div className="relative mt-4 shrink-0">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="rounded-full pl-9"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`group relative flex items-center gap-2 rounded-2xl text-sm ${
                selected.has(t.id)
                  ? "bg-primary/15"
                  : t.id === threadId
                    ? "bg-secondary font-semibold"
                    : "hover:bg-muted"
              }`}
            >
              {selecting && (
                <input
                  type="checkbox"
                  aria-label={`Select ${t.title}`}
                  checked={selected.has(t.id)}
                  onChange={() => toggleSelect(t.id)}
                  className="ml-3 size-4 shrink-0 accent-primary"
                />
              )}
              <Link
                to="/purchase-pal/$threadId"
                params={{ threadId: t.id }}
                className={`block min-w-0 flex-1 truncate p-3 ${selecting ? "pl-1 pr-3" : "pr-9"}`}
                onClick={(e) => {
                  if (selecting) {
                    e.preventDefault();
                    toggleSelect(t.id);
                  }
                }}
              >
                {t.title}
              </Link>
              {!selecting && (
              <button
                type="button"
                aria-label="Delete conversation"
                onClick={() => void remove(t.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b p-4">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileThreads(true)}>
            <Menu />
          </Button>
          <div className="grid size-10 place-items-center rounded-full bg-secondary">
            <MessageCircle className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold">Purchase Pal</h1>
            <p className="text-xs text-muted-foreground">Budget-aware, judgment-free guidance</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => void saveItem()}
            title={existingSaved ? "Remove from Saved for later" : "Save this item"}
          >
            <Heart className={existingSaved ? "fill-[#9ab999] text-[#719171]" : undefined} />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSaved(true)}>
            <PanelRight />
          </Button>
        </header>

        <Conversation className="min-h-0 flex-1 overflow-hidden">
          <ConversationContent>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <div className="text-muted-foreground">
                  <MessageCircle className="size-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-semibold">
                    <Typewriter text="What are you thinking of buying?" />
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Share the item, price, and how much you want it. A photo helps too.
                  </p>
                </div>
              </motion.div>
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts?.map((p, i) =>
                      p.type === "text" ? (
                        <MessageResponse key={i}>{p.text}</MessageResponse>
                      ) : p.type === "file" || p.type === "image" ? (
                        <img
                          key={i}
                          src={p.url}
                          alt="Purchase attachment"
                          className="w-full max-w-sm max-h-[28rem] rounded-2xl bg-white/40 object-contain"
                        />
                      ) : null
                    )}
                  </MessageContent>
                </Message>
              ))
            )}
            {sending && (
              <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
                <Shimmer>Checking your plan and recent spending…</Shimmer>
              </div>
            )}
            {chatError && (
              <p className="mx-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{chatError}</p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="shrink-0 border-t p-4">
          <PromptInput
            accept="image/*"
            maxFiles={1}
            maxFileSize={10 * 1024 * 1024}
            onSubmit={submit}
            className="rounded-3xl bg-white"
          >
            <PromptInputBody>
              <PromptInputTextarea placeholder="Describe the item, price, and what draws you to it…" />
            </PromptInputBody>
            <PromptInputFooter>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold hover:bg-muted">
                  <ImagePlus className="size-4" />
                  {photo ? photo.name : "Insert a photo"}
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <PromptInputSubmit status={sending ? "submitted" : "ready"} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>

      <aside
        className={`${
          mobileSaved ? "absolute inset-y-0 right-0 z-30 flex w-72" : "hidden"
        } flex-col border-l bg-background/95 p-5 lg:flex`}
      >
        <div className="flex shrink-0 items-center justify-between">
          <div>
            <p className="eyebrow">Heart list</p>
            <h2 className="mt-1 font-display text-lg font-bold">Saved for later</h2>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSaved(false)}>
            <X />
          </Button>
        </div>
        <p className="mt-2 shrink-0 text-xs leading-5 text-muted-foreground">Keeping an item here creates space before deciding.</p>
        <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {saved.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {s.photo_path && photoUrls[s.photo_path] && (
                <div className="relative">
                  <img
                    src={photoUrls[s.photo_path]}
                    alt={s.name}
                    className="h-32 w-full bg-secondary/40 object-contain p-2"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold leading-snug">{s.name}</p>
                  <button
                    type="button"
                    title="Delete saved item"
                    onClick={() => void removeSavedItem(s.id, s.photo_path)}
                    className="rounded-full p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!saved.length && (
            <div className="rounded-2xl border border-dashed p-5 text-center text-xs text-muted-foreground">
              Tap the heart in a conversation to save the item here.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Typewriter({ text, speed = 45 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span>{displayed}</span>;
}

function itemName(userText: string): string {
  const clean = userText.replace(/[*_#`>]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const firstClause = clean.split(/[.!?\n]/)[0]?.trim() ?? clean;
  return firstClause.length > 80 ? `${firstClause.slice(0, 77)}…` : firstClause;
}

function recommendationSummary(text: string): string {
  const clean = text
    .replace(/[*_#`>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "Saved from Purchase Pal";
  const sentences = clean.match(/[^.!?]+[.!?]?/g) ?? [clean];
  const recIndex = sentences.findIndex((s) =>
    /recommend|suggest|verdict|buy it|go ahead|wait|skip|hold off|save|worth/i.test(s)
  );
  const picked =
    recIndex >= 0
      ? sentences.slice(recIndex, recIndex + 2)
      : sentences.slice(-2);
  const summary = picked.join(" ").trim();
  return summary.length > 180 ? `${summary.slice(0, 177)}…` : summary;
}
