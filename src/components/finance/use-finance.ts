import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CATEGORIES, monthKey } from "@/lib/finance";
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
    let { data: current, error: budgetError } = await supabase.from("monthly_budgets").select("*").eq("month", monthKey()).maybeSingle();
    if (budgetError) { setError(budgetError.message); setLoading(false); return; }
    if (!current) {
      const created = await supabase.from("monthly_budgets").insert({ user_id: user.id, month: monthKey(), target_amount: 1440 }).select().single();
      if (created.error) { setError(created.error.message); setLoading(false); return; }
      current = created.data;
      if (!current) { setLoading(false); return; }
      const seed = DEFAULT_CATEGORIES.map((c) => ({ user_id: user.id, budget_id: current!.id, name: c.name, icon: c.icon, description: c.description, examples: [...c.examples], target_amount: c.target }));
      await supabase.from("budget_categories").insert(seed);
    }
    const [{ data: cats, error: catsError }, { data: txs, error: txError }] = await Promise.all([
      supabase.from("budget_categories").select("*").eq("budget_id", current.id).order("created_at"),
      supabase.from("transactions").select("*").gte("spent_on", monthKey()).order("spent_on", { ascending: false }),
    ]);
    setBudget(current); setCategories(cats ?? []); setTransactions(txs ?? []);
    setError(catsError?.message ?? txError?.message ?? null); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { budget, categories, transactions, loading, error, reload: load };
}
