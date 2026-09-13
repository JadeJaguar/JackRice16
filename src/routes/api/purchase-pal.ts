import { createFileRoute } from "@tanstack/react-router";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { UIMessage, UIMessagePart } from "ai";
import { createSupabaseServerClient } from "@/lib/supabase.server";

export const Route = createFileRoute("/api/purchase-pal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        let supabase;
        try {
          supabase = createSupabaseServerClient(token);
        } catch (e) {
          console.error("[purchase-pal] supabase client error", e);
          return new Response("Server configuration error", { status: 500 });
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);
        if (userError || !user) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { threadId?: string; messages?: UIMessage[] } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const threadId = body.threadId;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (!threadId || messages.length === 0) {
          return new Response("Bad request: threadId and messages are required", { status: 400 });
        }

        const { data: thread } = await supabase
          .from("purchase_threads")
          .select("id, title")
          .eq("id", threadId)
          .eq("user_id", user.id)
          .single();
        if (!thread) {
          return new Response("Forbidden", { status: 403 });
        }

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const { error: insertErr } = await supabase.from("purchase_messages").insert({
            thread_id: threadId,
            user_id: user.id,
            role: "user",
            parts: lastUser.parts as any,
          });
          if (insertErr) {
            console.error("[purchase-pal] failed to save user message", insertErr);
          }
        }

        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
        const [{ data: budget }, { data: cats }, { data: txs }, { data: saved }] = await Promise.all([
          supabase.from("monthly_budgets").select("*").eq("user_id", user.id).eq("month", month).maybeSingle(),
          supabase.from("budget_categories").select("*").eq("user_id", user.id).order("created_at"),
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .gte("spent_on", month)
            .order("spent_on", { ascending: false })
            .limit(40),
          supabase.from("saved_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        ]);

        const categories = cats ?? [];
        const transactions = txs ?? [];
        const savedItems = saved ?? [];
        const totalTarget = Number(budget?.target_amount ?? categories.reduce((s, c) => s + Number(c.target_amount), 0));
        const spent = transactions.reduce((s, t) => s + Number(t.amount), 0);
        const remaining = Math.max(totalTarget - spent, 0);

        const categorySummary = categories
          .map((c) => {
            const used = transactions.filter((t) => t.category_id === c.id).reduce((s, t) => s + Number(t.amount), 0);
            const target = Number(c.target_amount);
            return {
              name: c.name,
              target,
              used,
              remaining: Math.max(target - used, 0),
            };
          })
          .sort((a, b) => b.used - a.used);

        const system = buildSystemPrompt({
          totalTarget,
          spent,
          remaining,
          categories: categorySummary,
          recentTransactions: transactions.slice(0, 15),
          savedItems: savedItems.slice(0, 10),
        });

        const coreMessages = messages.map((m) => convertToCoreMessage(m)).filter(Boolean) as any[];

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Purchase Pal is not configured yet", { status: 500 });
        const openai = createOpenAI({
          apiKey,
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

        const userText = (lastUser?.parts ?? [])
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ")
          .slice(0, 500);
        const hasPhoto = (lastUser?.parts ?? []).some((p) => p.type === "file");
        const needsTitle = !thread.title || thread.title === "New purchase thought";

        const result = streamText({
          model: openai.responses("openai/gpt-6-astra"),
          system,
          messages: coreMessages,
          maxOutputTokens: 1400,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
          onError(event) {
            console.error("[purchase-pal] model error", event.error);
          },
          async onFinish(event) {
            const text = event.text;
            if (text) {
              const { error: assistantErr } = await supabase.from("purchase_messages").insert({
                thread_id: threadId,
                user_id: user.id,
                role: "assistant",
                parts: [{ type: "text", text }] as any,
              });
              if (assistantErr) {
                console.error("[purchase-pal] failed to save assistant message", assistantErr);
              }
            }
            if (needsTitle) {
              try {
                const { text: titleText } = await generateText({
                  model: openai.responses("openai/gpt-6-astra"),
                  maxOutputTokens: 60,
                  providerOptions: {
                    openai: {
                      forceReasoning: true,
                      reasoningEffort: "low",
                      store: false,
                      include: ["reasoning.encrypted_content"],
                    },
                  },
                  prompt: `Name this shopping conversation with a short title (2-6 words) based on the product being considered. Just the title, no quotes, no punctuation at the end.\n\nUser: ${userText || (hasPhoto ? "(shared a photo of an item)" : "")}\nAssistant: ${text.slice(0, 500)}`,
                });
                const title = titleText.trim().replace(/^["']|["'.]+$/g, "").slice(0, 80);
                if (title) {
                  const { error: titleErr } = await supabase
                    .from("purchase_threads")
                    .update({ title })
                    .eq("id", threadId)
                    .eq("user_id", user.id);
                  if (titleErr) {
                    console.error("[purchase-pal] failed to save thread title", titleErr);
                  }
                }
              } catch (e) {
                console.error("[purchase-pal] title generation failed", e);
              }
            }
          },
        });

        return result.toUIMessageStreamResponse({
          onError: (error) => {
            console.error("[purchase-pal] stream error", error);
            const message = error instanceof Error ? error.message : String(error);
            if (/429|rate limit/i.test(message)) {
              return "Purchase Pal is getting a lot of questions right now. Please try again in a moment.";
            }
            if (/402|credit/i.test(message)) {
              return "Purchase Pal is out of AI credits. Add credits in Lovable to keep chatting.";
            }
            if (/image/i.test(message)) {
              return "I couldn't read that photo. Try a JPG or PNG picture of the item.";
            }
            return `Purchase Pal hit a snag: ${message}`;
          },
        });
      },
    },
  },
});

type CategorySummary = { name: string; target: number; used: number; remaining: number };

function buildSystemPrompt(ctx: {
  totalTarget: number;
  spent: number;
  remaining: number;
  categories: CategorySummary[];
  recentTransactions: { item_name: string | null; amount: number; spent_on: string; category_id: string | null }[];
  savedItems: { name: string | null; estimated_price: number | null; notes: string | null }[];
}) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const lines = [
    `You are Purchase Pal, a calm, non-judgmental shopping consultant inside Buy or Bye. Your job is to help the user think through a possible purchase.`,
    `Use their monthly plan and recent spending to ground your advice. Be warm, concise, and encouraging. Never shame spending.`,
    ``,
    `Current month at a glance:`,
    `- Monthly plan: ${money(ctx.totalTarget)}`,
    `- Spent so far: ${money(ctx.spent)}`,
    `- Remaining: ${money(ctx.remaining)}`,
    ``,
    `Category budgets:`,
    ...ctx.categories.map((c) => `- ${c.name}: ${money(c.used)} of ${money(c.target)} spent (${money(c.remaining)} left)`),
  ];

  if (ctx.recentTransactions.length) {
    lines.push("", "Recent purchases:");
    lines.push(...ctx.recentTransactions.map((t) => `- ${t.item_name || "Unnamed"} for ${money(Number(t.amount))}`));
  }

  if (ctx.savedItems.length) {
    lines.push("", "Items already saved for later:");
    lines.push(...ctx.savedItems.map((s) => `- ${s.name || "Unnamed"}${s.estimated_price ? ` (${money(Number(s.estimated_price))})` : ""}`));
  }

  lines.push(
    "",
    "Always start by naming the item and the single best-matching category from the list above (say 'closest match' if none fit well), then show that category's remaining budget.",
    "When the user shares a photo, briefly say what you see: the product, brand if visible, and any price shown.",
    "Then ask one or two useful follow-up questions, each paired with short advice on why it matters. Good angles: real price and any sale timing, how often they'd use it, whether they already own something similar, whether an existing saved item covers the same need, and whether it fits this month or next.",
    "Finish with a clear, supportive recommendation: buy now, wait, or save it to the heart list, with one sentence of reasoning tied to their numbers. Keep replies under three short paragraphs."
  );


  return lines.join("\n");
}

function convertToCoreMessage(message: UIMessage): { role: "user" | "assistant"; content: any } | null {
  const parts = message.parts as any[];
  if (message.role === "assistant") {
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    return { role: "assistant", content: text };
  }

  if (message.role === "user") {
    const textParts = parts.filter((p) => p.type === "text").map((p) => p.text);
    const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const fileParts = parts.filter(
      (p) =>
        p.type === "file" &&
        typeof p.url === "string" &&
        supported.includes(normalizeMediaType(p.url, p.mediaType))
    );

    if (fileParts.length === 0) {
      return { role: "user", content: textParts.join("\n") };
    }

    const content: any[] = [];
    if (textParts.length) {
      content.push({ type: "text", text: textParts.join("\n") });
    }
    for (const f of fileParts) {
      content.push({
        type: "file",
        mediaType: normalizeMediaType(f.url, f.mediaType),
        data: f.url,
      });
    }
    return { role: "user", content };
  }

  return null;
}

// Photos arrive as data URLs; trust the URL's own media type over a browser-reported
// one (iOS often reports image/heic or an empty string).
function normalizeMediaType(url: string, mediaType?: string): string {
  const match = /^data:([^;,]+)/.exec(url);
  const fromUrl = match?.[1]?.toLowerCase();
  if (fromUrl) return fromUrl === "image/jpg" ? "image/jpeg" : fromUrl;
  const declared = (mediaType ?? "").toLowerCase();
  return declared === "image/jpg" ? "image/jpeg" : declared;
}
