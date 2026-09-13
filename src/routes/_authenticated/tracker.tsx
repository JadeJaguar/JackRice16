import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Check, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
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
import { useFinance } from "@/components/finance/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { money } from "@/lib/finance";

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

const LOG_MARKER = /LOG_TRANSACTION:\s*(\{.*\})\s*$/s;

type LogPayload = { itemName: string; amount: number; spentOn: string; categoryName: string };

export const Route = createFileRoute("/_authenticated/tracker")({
  component: Tracker,
  head: () => ({
    meta: [
      { title: "Spending tracker — Buy or Bye" },
      { name: "description", content: "Log purchases in a spreadsheet-style view and watch your budget update in real time." },
      { property: "og:title", content: "Spending tracker — Buy or Bye" },
      { property: "og:description", content: "Log purchases in a spreadsheet-style view and watch your budget update in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Transaction = Tables<"transactions">;
type EditableTransaction = Pick<Transaction, "item_name" | "merchant" | "amount" | "spent_on" | "category_id">;
type AssistantMessage = { id: string; role: "user" | "assistant"; text: string; logged?: LogPayload };

const greeting: AssistantMessage = {
  id: "tracker-welcome",
  role: "assistant",
  text: "What did you buy? You can tell me everything at once, or we can take it one detail at a time.",
};

function Tracker() {
  const { categories, transactions, reload } = useFinance();
  const [showAssistant, setShowAssistant] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditableTransaction | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [messages, setMessages] = useState<AssistantMessage[]>([greeting]);
  const [sending, setSending] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const sendMessage = async ({ text }: { text: string }) => {
    if (!text.trim()) return;
    setAssistantError(null);
    const history = [...messages, { id: crypto.randomUUID(), role: "user" as const, text: text.trim() }];
    setMessages(history);
    setSending(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const transcript = history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n");
      const prompt = [
        "You are the friendly spending-log assistant inside Buy or Bye.",
        "Help the user record one purchase by asking one short question at a time.",
        "Collect the item, amount, purchase date, and one category before summarizing the entry.",
        `Today is ${today}. Available categories: ${categories.map((c) => c.name).join(", ")}.`,
        "If the user gives several details at once, acknowledge them and ask only for the next missing detail.",
        "After all details are known, show a concise summary and explicitly ask the user to confirm.",
        "Only once the user clearly confirms (e.g. yes, confirm, looks good), reply with a short confirmation sentence, then on its own final line output exactly this, filled in with the real values and nothing else after it:",
        `LOG_TRANSACTION: {"itemName": "...", "amount": 0, "spentOn": "YYYY-MM-DD", "categoryName": "..."}`,
        "Never invent an amount, date, category, or item, and never output that line before the user has confirmed.",
        "",
        "Conversation so far:",
        transcript,
      ].join("\n");

      const result = await authedFetch("/chat", { method: "POST", body: JSON.stringify({ message: prompt }) });
      const reply = String(result.reply ?? "").trim();
      const match = LOG_MARKER.exec(reply);
      let logged: LogPayload | undefined;
      let displayText = reply;

      if (match) {
        displayText = reply.slice(0, match.index).trim();
        try {
          const payload = JSON.parse(match[1]) as LogPayload;
          const category = categories.find((c) => c.name.toLowerCase() === payload.categoryName.trim().toLowerCase());
          if (category && payload.itemName && payload.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payload.spentOn)) {
            const { error: insertError } = await supabase.from("transactions").insert({
              user_id: (await supabase.auth.getUser()).data.user?.id,
              category_id: category.id,
              item_name: payload.itemName.trim(),
              amount: payload.amount,
              spent_on: payload.spentOn,
            });
            if (!insertError) {
              logged = payload;
              void reload();
            }
          }
        } catch (err) {
          console.error("[tracker-assistant] failed to parse log payload", err);
        }
      }

      setMessages([...history, { id: crypto.randomUUID(), role: "assistant", text: displayText || "Got it.", logged }]);
    } catch (err) {
      console.error("[tracker-assistant] chat error", err);
      const message = err instanceof Error ? err.message : String(err);
      setAssistantError(/429|rate limit/i.test(message) ? "The assistant needs a short pause. Please try again soon." : "I couldn't continue that entry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const beginEdit = (transaction: Transaction) => {
    setRowError(null);
    setEditingId(transaction.id);
    setEdit({
      item_name: transaction.item_name,
      merchant: transaction.merchant,
      amount: Number(transaction.amount),
      spent_on: transaction.spent_on,
      category_id: transaction.category_id,
    });
  };

  const saveEdit = async () => {
    if (!editingId || !edit || !edit.item_name.trim() || Number(edit.amount) <= 0) return;
    setSaving(true);
    setRowError(null);
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        item_name: edit.item_name.trim(),
        merchant: edit.merchant?.trim() || null,
        amount: Number(edit.amount),
        spent_on: edit.spent_on,
        category_id: edit.category_id,
      })
      .eq("id", editingId);
    setSaving(false);
    if (updateError) {
      setRowError(updateError.message);
      return;
    }
    setEditingId(null);
    setEdit(null);
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Spending tracker</p>
          <h1 className="mt-2 text-4xl font-bold">Keep the details easy.</h1>
          <p className="mt-3 text-lg text-muted-foreground/90">Talk through a purchase or edit any cell. Your plan updates as soon as it is saved.</p>
        </div>
        <Button onClick={() => setShowAssistant((current) => !current)}>
          {showAssistant ? <X /> : <Plus />}
          {showAssistant ? "Close assistant" : "Log with assistant"}
        </Button>
      </div>

      {showAssistant && (
        <section className="glass-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/60 p-5 sm:p-6">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary"><Bot className="size-5" /></div>
            <div>
              <h2 className="font-display text-xl font-bold">Let&apos;s log it together.</h2>
              <p className="mt-0.5 text-base text-muted-foreground">I&apos;ll ask for the item, amount, date, and category, then wait for your confirmation.</p>
            </div>
          </div>
          <Conversation className="h-[390px]">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-5 p-5 sm:p-6">
              {messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent className={message.role === "assistant" ? "rounded-2xl bg-white/70 px-4 py-3 shadow-sm" : undefined}>
                    <MessageResponse>{message.text}</MessageResponse>
                    {message.logged && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Check className="size-3.5" />Logged: {message.logged.itemName} · {money(message.logged.amount)} · {message.logged.categoryName}
                      </p>
                    )}
                  </MessageContent>
                </Message>
              ))}
              {sending && <Shimmer className="text-sm">Checking the details…</Shimmer>}
              {assistantError && (
                <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{assistantError}</p>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="border-t border-border/60 p-4 sm:p-5">
            <PromptInput
              className="mx-auto max-w-3xl rounded-3xl bg-white"
              onSubmit={async ({ text }) => {
                if (text.trim()) await sendMessage({ text });
              }}
            >
              <PromptInputBody><PromptInputTextarea placeholder="Tell me what you bought…" /></PromptInputBody>
              <PromptInputFooter>
                <span className="px-2 text-xs text-muted-foreground">Nothing is saved until you confirm.</span>
                <PromptInputSubmit status={sending ? "submitted" : "ready"} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>
      )}

      <section className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
          <div><h2 className="mt-1 text-2xl font-bold">This month&apos;s purchases</h2></div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 text-primary" />Select edit to update a row.</p>
        </div>
        {rowError && <p className="m-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{rowError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="pl-8 pr-4 py-4">Date</th><th>Item</th><th>Category</th><th>Merchant</th><th className="text-right">PRICE</th><th className="pl-4 pr-8 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const editing = editingId === transaction.id && edit;
                return (
                  <tr key={transaction.id} className="border-t border-border/60 transition-colors hover:bg-white/45">
                    <td className="pl-8 pr-4 py-3">
                      {editing ? <Input aria-label="Purchase date" className="min-w-36 bg-white" type="date" value={edit.spent_on} onChange={(event) => setEdit({ ...edit, spent_on: event.target.value })} /> : new Date(`${transaction.spent_on}T12:00:00`).toLocaleDateString()}
                    </td>
                    <td className="font-medium">
                      {editing ? <Input aria-label="Item name" className="min-w-40 bg-white" value={edit.item_name} onChange={(event) => setEdit({ ...edit, item_name: event.target.value })} /> : transaction.item_name}
                    </td>
                    <td>
                      {editing ? (
                        <Select value={edit.category_id ?? "uncategorized"} onValueChange={(value) => setEdit({ ...edit, category_id: value === "uncategorized" ? null : value })}>
                          <SelectTrigger aria-label="Category" className="min-w-40 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="uncategorized">Other</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : categories.find((category) => category.id === transaction.category_id)?.name ?? "Other"}
                    </td>
                    <td className="text-muted-foreground">
                      {editing ? <Input aria-label="Merchant" className="min-w-36 bg-white" value={edit.merchant ?? ""} onChange={(event) => setEdit({ ...edit, merchant: event.target.value })} placeholder="Optional" /> : transaction.merchant || "—"}
                    </td>
                    <td className="text-right font-semibold">
                      {editing ? <Input aria-label="Amount" className="ml-auto w-28 bg-white text-right" min="0.01" step="0.01" type="number" value={edit.amount} onChange={(event) => setEdit({ ...edit, amount: Number(event.target.value) })} /> : money(Number(transaction.amount))}
                    </td>
                    <td className="pl-4 pr-8 text-right">
                      {editing ? (
                        <div className="flex justify-end gap-1">
                          <Button aria-label="Cancel changes" size="icon-sm" variant="ghost" onClick={() => { setEditingId(null); setEdit(null); }}><X /></Button>
                          <Button aria-label="Save changes" size="icon-sm" disabled={saving || !edit.item_name.trim() || Number(edit.amount) <= 0} onClick={() => void saveEdit()}><Check /></Button>
                        </div>
                      ) : <Button aria-label={`Edit ${transaction.item_name}`} size="icon-sm" variant="ghost" onClick={() => beginEdit(transaction)}><Pencil /></Button>}
                    </td>
                  </tr>
                );
              })}
              {!transactions.length && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Your first entry will appear here.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="text-right"><Button variant="link" asChild><Link to="/budget">Adjust your monthly budget →</Link></Button></div>
    </div>
  );
}