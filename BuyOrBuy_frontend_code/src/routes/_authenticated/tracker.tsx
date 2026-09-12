import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { Bot, Check, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { useFinance } from "@/components/finance/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { money } from "@/lib/finance";

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

const greeting: UIMessage = {
  id: "tracker-welcome",
  role: "assistant",
  parts: [{ type: "text", text: "What did you buy? You can tell me everything at once, or we can take it one detail at a time." }],
};

function Tracker() {
  const { categories, transactions, reload } = useFinance();
  const [showAssistant, setShowAssistant] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditableTransaction | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/tracker-assistant",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(init?.headers);
          if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
          return fetch(input, { ...init, headers });
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: "spending-tracker-assistant",
    messages: [greeting],
    transport,
    onFinish: () => void reload(),
  });

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
                    {message.parts.map((part, index) => {
                      if (part.type === "text") return <MessageResponse key={index}>{part.text}</MessageResponse>;
                      if (part.type === "reasoning") {
                        return (
                          <Reasoning key={index} isStreaming={status === "streaming" && message.id === messages.at(-1)?.id}>
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      }
                      if (isToolUIPart(part)) {
                        return (
                          <Tool key={index} defaultOpen={part.state === "output-error"}>
                            <ToolHeader type={part.type as never} state={part.state} toolName={part.type === "dynamic-tool" ? getToolName(part) : undefined as never} title="Adding purchase to your sheet" />
                            <ToolContent>
                              <ToolInput input={part.input} />
                              <ToolOutput output={"output" in part ? part.output : undefined} errorText={"errorText" in part ? part.errorText : undefined} />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
              {status === "submitted" && <Shimmer className="text-sm">Checking the details…</Shimmer>}
              {error && (
                <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                  {error.message.includes("429") ? "The assistant needs a short pause. Please try again soon." : "I couldn&apos;t continue that entry. Please try again."}
                </p>
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
                <PromptInputSubmit status={status} onStop={stop} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>
      )}

      <section className="glass-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
          <div><p className="eyebrow">Live ledger</p><h2 className="mt-1 text-2xl font-bold">This month&apos;s purchases</h2></div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 text-primary" />Select edit to update a row.</p>
        </div>
        {rowError && <p className="m-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{rowError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-4">Date</th><th>Item</th><th>Category</th><th>Merchant</th><th className="text-right">PRICE</th><th className="px-4 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const editing = editingId === transaction.id && edit;
                return (
                  <tr key={transaction.id} className="border-t border-border/60 transition-colors hover:bg-white/45">
                    <td className="p-3">
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
                    <td className="px-4 text-right">
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