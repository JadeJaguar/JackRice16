import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Heart, Search, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinance } from "@/components/finance/use-finance";
import { money } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/decide")({
  component: DecidePage,
  head: () => ({
    meta: [
      { title: "Decide — Buy or Bye" },
      { name: "description", content: "Describe an item and think it through before you buy." },
    ],
  }),
});

// Point this at your Express backend. Set VITE_API_URL in your .env file,
// for example VITE_API_URL=http://localhost:3000
const API_URL = import.meta.env["VITE_API_URL"] || "http://localhost:3000";

type SearchResult = {
  title: string;
  price?: string;
  source?: string;
  link?: string;
  thumbnail?: string;
};

type Step = "input" | "loading" | "result" | "saved";

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

function DecidePage() {
  const { categories, transactions, reload } = useFinance();
  const [itemDescription, setItemDescription] = useState("");
  const [price, setPrice] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>("");
  const [nudge, setNudge] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const matchedCategory = categories.find(
    (c) => c.name.toLowerCase() === category.toLowerCase()
  );
  const used = matchedCategory
    ? transactions
        .filter((t) => t.category_id === matchedCategory.id)
        .reduce((s, t) => s + Number(t.amount), 0)
    : 0;
  const target = matchedCategory ? Number(matchedCategory.target_amount) : 0;
  const remaining = Math.max(target - used, 0);
  const overBudget = matchedCategory ? used >= target : false;

  const runDecision = async () => {
    if (!itemDescription.trim()) return;
    setStep("loading");
    setError(null);
    try {
      const [classifyRes, searchRes] = await Promise.all([
        authedFetch("/classify", {
          method: "POST",
          body: JSON.stringify({
            itemDescription,
            categories: categories.map((c) => c.name),
          }),
        }),
        authedFetch(`/search?query=${encodeURIComponent(itemDescription)}`),
      ]);

      setCategory(classifyRes.category);
      setResults(searchRes.results || []);

      const nudgeRes = await authedFetch("/classify/nudge", {
        method: "POST",
        body: JSON.stringify({ itemDescription, category: classifyRes.category }),
      });
      setNudge(nudgeRes.nudge);

      setStep("result");
    } catch (err) {
      console.error(err);
      setError("Something went wrong reaching Purchase Pal's brain. Try again.");
      setStep("input");
    }
  };

  const decide = async (decision: "bought" | "not needed yet") => {
    setError(null);
    try {
      await authedFetch("/purchase", {
        method: "POST",
        body: JSON.stringify({
          item: itemDescription,
          category,
          price: price ? Number(price) : null,
          decision,
          alternatives: results,
        }),
      });
      if (decision === "bought") {
        // Tiger Data holds the full decision (alternatives, nudge context).
        // Also mirror it into Supabase transactions so it shows up in the
        // budget-remaining figure and the Expenses Tracker like any other
        // logged spend.
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { error: txError } = await supabase.from("transactions").insert({
            user_id: userData.user.id,
            category_id: matchedCategory?.id ?? null,
            item_name: itemDescription,
            amount: price ? Number(price) : 0,
          });
          if (txError) console.error(txError);
        }
        await reload();
      }
      setStep("saved");
    } catch (err) {
      console.error(err);
      setError("Could not save that decision. Try again.");
    }
  };

  const reset = () => {
    setItemDescription("");
    setPrice("");
    setCategory("");
    setNudge("");
    setResults([]);
    setStep("input");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <p className="eyebrow">Buy or Bye</p>
        <h1 className="mt-2 text-4xl font-bold">Think it through before you buy.</h1>
        <p className="mt-3 text-lg text-muted-foreground/90">
          Describe what you want to buy. We will check it against your budget and find a few alternatives.
        </p>
      </div>

      {error && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      {step === "input" && (
        <div className="glass-card space-y-4 p-6 sm:p-8">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What are you thinking of buying?
          </label>
          <Input
            className="rounded-full bg-white"
            placeholder="For example: wireless noise cancelling headphones"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
          />
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Rough price, if you know it
          </label>
          <Input
            className="rounded-full bg-white"
            type="number"
            placeholder="150"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button size="lg" onClick={runDecision} disabled={!itemDescription.trim()}>
            Check this purchase <ArrowRight />
          </Button>
        </div>
      )}

      {step === "loading" && (
        <div className="glass-card flex items-center gap-3 p-8">
          <Sparkles className="animate-pulse text-primary" />
          <p>Classifying, checking your budget, and looking for alternatives…</p>
        </div>
      )}

      {step === "result" && (
        <div className="space-y-5">
          <div className="glass-card p-6 sm:p-8">
            <p className="eyebrow">Category</p>
            <p className="mt-1 text-2xl font-bold">{category}</p>
            {matchedCategory ? (
              <div className="mt-5 rounded-2xl bg-secondary/60 p-4 text-sm">
                {money(used)} spent of {money(target)} planned this month, {money(remaining)} left.
                {overBudget && (
                  <p className="mt-1 font-semibold text-destructive">
                    This category is already at or over its plan.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No matching budget category found yet. You can still decide below.
              </p>
            )}
          </div>

          {nudge && (
            <div className="glass-card p-6 sm:p-8">
              <p className="eyebrow">A gentle question</p>
              <p className="mt-2 text-lg">{nudge}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="glass-card p-6 sm:p-8">
              <p className="eyebrow flex items-center gap-2"><Search className="size-4" />A few alternatives</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {results.slice(0, 6).map((r, i) => (
                  <a
                    key={i}
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-control block rounded-2xl p-4 text-sm hover:ring-2 hover:ring-primary/25"
                  >
                    <p className="font-semibold line-clamp-2">{r.title}</p>
                    <p className="mt-1 text-muted-foreground">{r.price} · {r.source}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => decide("bought")}>
              <Check /> Buy it
            </Button>
            <Button size="lg" variant="soft" onClick={() => decide("not needed yet")}>
              <Heart /> Not needed yet
            </Button>
            <Button size="lg" variant="ghost" onClick={reset}>
              <X /> Start over
            </Button>
          </div>
        </div>
      )}

      {step === "saved" && (
        <div className="glass-card space-y-4 p-8 text-center">
          <Sparkles className="mx-auto text-primary" />
          <p className="text-xl font-semibold">Got it, saved to your decisions.</p>
          <Button onClick={reset}>Check another item</Button>
        </div>
      )}
    </div>
  );
}
