import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Heart, ImagePlus, Menu, MessageCircle, PanelRight, Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [query, setQuery] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [mobileThreads, setMobileThreads] = useState(false);
  const [mobileSaved, setMobileSaved] = useState(false);

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
    setInitial(
      (ms ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: m.parts as unknown as UIMessage["parts"],
      }))
    );
  };

  useEffect(() => {
    void load();
  }, [threadId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/purchase-pal",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const h = new Headers(init?.headers);
          if (data.session) h.set("Authorization", `Bearer ${data.session.access_token}`);
          return fetch(input, { ...init, headers: h });
        },
        body: { threadId },
      }),
    [threadId]
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initial ?? [],
    transport,
    onFinish: () => void load(),
  });

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

  const submit = async ({ text, files }: { text: string; files: any[] }) => {
    if (!text.trim() && !files.length && !photo) return;
    let fileParts = files;
    if (photo) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(photo);
      });
      fileParts = [
        ...files,
        { type: "file", mediaType: photo.type, url: dataUrl, filename: photo.name },
      ];
    }
    await sendMessage({ text, files: fileParts });
    setPhoto(null);
  };

  const saveItem = async () => {
    const userMessage = [...messages].reverse().find((m) => m.role === "user");
    const userText = userMessage?.parts?.find((p: any) => p.type === "text") as any;
    if (!userText) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("saved_items").insert({
      user_id: u.user.id,
      thread_id: threadId,
      name: String(userText.text).slice(0, 80),
      notes: "Saved from Purchase Pal",
    });
    void load();
  };

  const filtered = threads.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));

  if (!initial) return <div className="glass-card h-[70vh] animate-pulse" />;

  return (
    <div className="relative -mx-1 grid h-[calc(100vh-10rem)] min-h-[620px] overflow-hidden rounded-3xl border border-white/70 bg-white/65 shadow-xl backdrop-blur-xl lg:grid-cols-[270px_1fr_290px]">
      <aside
        className={`${
          mobileThreads ? "absolute inset-y-0 left-0 z-30 flex w-72" : "hidden"
        } flex-col border-r bg-background/95 p-4 lg:flex`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Conversations</h2>
          <Button size="icon" variant="ghost" onClick={() => setMobileThreads(false)} className="lg:hidden">
            <X />
          </Button>
        </div>
        <Button className="mt-4" variant="soft" onClick={() => void create()}>
          <Plus />
          New conversation
        </Button>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="rounded-full pl-9"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {filtered.map((t) => (
            <Link
              key={t.id}
              to="/purchase-pal/$threadId"
              params={{ threadId: t.id }}
              className={`block rounded-2xl p-3 text-sm ${
                t.id === threadId ? "bg-secondary font-semibold" : "hover:bg-muted"
              }`}
            >
              {t.title}
            </Link>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b p-4">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileThreads(true)}>
            <Menu />
          </Button>
          <div className="grid size-10 place-items-center rounded-full bg-secondary">
            <MessageCircle className="text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold">Purchase Pal</h1>
            <p className="text-xs text-muted-foreground">Budget-aware, judgment-free guidance</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => void saveItem()} title="Save this item">
            <Heart />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSaved(true)}>
            <PanelRight />
          </Button>
        </header>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageCircle className="size-8" />}
                title="What are you thinking of buying?"
                description="Share the item, price, and how much you want it. A photo helps too."
              />
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts?.map((p: any, i: number) =>
                      p.type === "text" ? (
                        <MessageResponse key={i}>{p.text}</MessageResponse>
                      ) : p.type === "file" || p.type === "image" ? (
                        <img key={i} src={p.url} alt="Purchase attachment" className="max-h-64 rounded-2xl" />
                      ) : null
                    )}
                  </MessageContent>
                </Message>
              ))
            )}
            {(status === "submitted" || status === "streaming") && (
              <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
                <Shimmer>Checking your plan and recent spending…</Shimmer>
              </div>
            )}
            {error && (
              <p className="mx-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error.message?.includes("429")
                  ? "Your Pal needs a short pause. Please try again soon."
                  : "I couldn't complete that thought. Please try again."}
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t p-4">
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
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>

      <aside
        className={`${
          mobileSaved ? "absolute inset-y-0 right-0 z-30 block w-72" : "hidden"
        } border-l bg-background/95 p-5 lg:block`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Heart list</p>
            <h2 className="mt-1 font-display text-lg font-bold">Saved for later</h2>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSaved(false)}>
            <X />
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Keeping an item here creates space before deciding.</p>
        <div className="mt-5 space-y-3">
          {saved.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <Heart className="mb-3 size-4 fill-[#9ab999] text-[#719171]" />
              <p className="text-sm font-semibold">{s.name}</p>
              {s.estimated_price && (
                <p className="text-xs text-muted-foreground">${Number(s.estimated_price).toFixed(2)}</p>
              )}
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
