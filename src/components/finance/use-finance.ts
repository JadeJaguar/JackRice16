import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { monthKey } from "@/lib/finance";
import type { Tables } from "@/integrations/supabase/types";

type Budget = Tables<"monthly_budgets">;
type Category = Tables<"budget_categories">;
type Transaction = Tables<"transactions">;

export function useFinance() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { setLoading(false); return; }
    const { data: current, error: budgetError } = await supabase.from("monthly_budgets").select("*").eq("month", monthKey()).maybeSingle();
    if (budgetError) { setError(budgetError.message); setLoading(false); return; }
    if (!current) {
      // No budget yet for this month: leave it null so the Budget page can
      // run the AI setup conversation instead of silently seeding defaults.
      setBudget(null); setCategories([]);
      const { data: txs } = await supabase.from("transactions").select("*").gte("spent_on", monthKey()).order("spent_on", { ascending: false });
      setTransactions(txs ?? []); setLoading(false);
      return;
    }
    const [{ data: cats, error: catsError }, { data: txs, error: txError }] = await Promise.all([
      supabase.from("budget_categories").select("*").eq("budget_id", current.id).order("created_at"),
      supabase.from("transactions").select("*").gte("spent_on", monthKey()).order("spent_on", { ascending: false }),
    ]);
    setBudget(current); setCategories(cats ?? []); setTransactions(txs ?? []);
    setError(catsError?.message ?? txError?.message ?? null); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Creates the month's budget from AI-collected per-category amounts
  // (name -> monthly amount), used once the setup conversation finishes.
  const createBudget = useCallback(async (amounts: { name: string; icon: string; description: string; examples: string[]; amount: number }[]) => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;
    const total = amounts.reduce((s, a) => s + a.amount, 0);
    const created = await supabase.from("monthly_budgets").insert({ user_id: user.id, month: monthKey(), target_amount: total }).select().single();
    if (created.error || !created.data) { setError(created.error?.message ?? "Could not create budget"); return; }
    const rows = amounts.map((a) => ({ user_id: user.id, budget_id: created.data.id, name: a.name, icon: a.icon, description: a.description, examples: a.examples, target_amount: a.amount }));
    const { error: catsError } = await supabase.from("budget_categories").insert(rows);
    if (catsError) { setError(catsError.message); return; }
    await load();
  }, [load]);

  return { budget, categories, transactions, loading, error, reload: load, createBudget };
}
