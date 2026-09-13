import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase.server";

type TrackerRequest = { messages?: UIMessage[] };

export const Route = createFileRoute("/api/tracker-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Please sign in again.", { status: 401 });

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("The spending assistant is not configured yet.", { status: 500 });

        let body: TrackerRequest;
        try {
          body = (await request.json()) as TrackerRequest;
        } catch {
          return new Response("The assistant received an invalid request.", { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("Add a message to start logging a purchase.", { status: 400 });
        }

        let supabase;
        try {
          supabase = createSupabaseServerClient(token);
        } catch {
          return new Response("The spending assistant is not configured yet.", { status: 500 });
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);
        if (userError || !user) return new Response("Please sign in again.", { status: 401 });

        const { data: categories, error: categoryError } = await supabase
          .from("budget_categories")
          .select("id,name")
          .eq("user_id", user.id)
          .order("created_at");
        if (categoryError) return new Response(categoryError.message, { status: 500 });

        const categoryList = categories ?? [];
        const lastUserText = [...body.messages]
          .reverse()
          .find((message) => message.role === "user")
          ?.parts.filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ") ?? "";
        const userConfirmed = /\b(yes|confirm|confirmed|log it|add it|save it|go ahead|looks good|that is right|that's right|correct)\b/i.test(lastUserText);

        const openai = createOpenAI({
          apiKey: key,
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });

        const result = streamText({
          model: openai.responses("openai/gpt-6-astra"),
          messages: await convertToModelMessages(body.messages),
          system: [
            "You are the friendly spending-log assistant inside Buy or Bye.",
            "Help the user record one purchase by asking one short question at a time.",
            "Collect the item, amount, purchase date, and one category before summarizing the entry.",
            `Today is ${new Date().toISOString().slice(0, 10)}. Available categories: ${categoryList.map((category) => category.name).join(", ")}.`,
            "If the user gives several details at once, acknowledge them and ask only for the next missing detail.",
            "After all details are known, show a concise summary and explicitly ask the user to confirm.",
            "Only call logTransaction after the user clearly confirms. Never invent an amount, date, category, or item.",
            "After the tool succeeds, tell the user the purchase is now in their tracker.",
          ].join("\n"),
          tools: {
            logTransaction: tool({
              description: "Record a fully confirmed purchase in the user's spending tracker.",
              inputSchema: z
                .object({
                  itemName: z.string().min(1),
                  amount: z.number().positive(),
                  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                  categoryName: z.string().min(1),
                })
                .strict(),
              execute: async ({ itemName, amount, spentOn, categoryName }) => {
                if (!userConfirmed) {
                  return { saved: false, message: "Ask the user to confirm this exact entry before saving it." };
                }
                const category = categoryList.find(
                  (candidate) => candidate.name.toLowerCase() === categoryName.trim().toLowerCase(),
                );
                if (!category) {
                  return { saved: false, message: `Choose one of these categories: ${categoryList.map((candidate) => candidate.name).join(", ")}.` };
                }
                const { data, error } = await supabase
                  .from("transactions")
                  .insert({
                    user_id: user.id,
                    category_id: category.id,
                    item_name: itemName.trim(),
                    amount,
                    spent_on: spentOn,
                  })
                  .select("id,item_name,amount,spent_on")
                  .single();
                if (error || !data) {
                  return { saved: false, message: error?.message ?? "The purchase could not be saved." };
                }
                return { saved: true, transaction: data };
              },
            }),
          },
          stopWhen: stepCountIs(4),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return result.toUIMessageStreamResponse({ sendReasoning: true });
      },
    },
  },
});