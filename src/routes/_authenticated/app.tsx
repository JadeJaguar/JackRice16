import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, PartyPopper, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFinance } from "@/components/finance/use-finance";
import { money } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";



export const Route = createFileRoute("/_authenticated/app")({
  component: Overview,
  head: () => ({
    meta: [
      { title: "Overview — Buy or Bye" },
      { name: "description", content: "See your monthly budget, spending progress, category pulse, and start a Purchase Pal chat." },
      { property: "og:title", content: "Overview — Buy or Bye" },
      { property: "og:description", content: "See your monthly budget, spending progress, category pulse, and start a Purchase Pal chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
function Overview() {
  const { budget, categories, transactions, loading, error } = useFinance();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[number] | null>(null);
  const spent = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const target = Number(budget?.target_amount ?? 0);
  const remaining = Math.max(target - spent, 0);
  const pct = target ? Math.min((spent / target) * 100, 100) : 0;
  const sortedCategories = useMemo(() => {
    const withSpent = categories.map((c) => ({
      ...c,
      used: transactions.filter((t) => t.category_id === c.id).reduce((s, t) => s + Number(t.amount), 0),
    }));
    withSpent.sort((a, b) => b.used - a.used);
    return withSpent;
  }, [categories, transactions]);
  if (loading) return <div className="glass-card h-72 animate-pulse" />;
  const selectedTx = selectedCategory
    ? transactions.filter((t) => t.category_id === selectedCategory.id).sort((a, b) => +new Date(b.spent_on) - +new Date(a.spent_on))
    : [];
  return <div className="space-y-6">
     <motion.section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}><div><p className="eyebrow">Your monthly overview</p><h1 className="mt-2 text-4xl font-bold sm:text-5xl">For a clear view of your money.</h1><p className="mt-3 text-lg text-muted-foreground/90">Progress, not pressure. Small choices build a steadier month.</p></div><Button asChild><Link to="/tracker"><Plus/>Log spending</Link></Button></motion.section>
    {error && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    <motion.section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55 }}>
      <div className="glass-card p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Still available</p><p className="mt-1 text-5xl font-display font-bold"><AnimatedMoney value={remaining} /></p></div><div className="rounded-2xl bg-accent p-3"><Sparkles className="text-primary"/></div></div><AnimatedProgress value={pct} className="mt-8 h-3"/><div className="mt-3 flex justify-between text-sm"><span>{money(spent)} spent</span><span>{money(target)} planned</span></div><div className="mt-7 rounded-2xl bg-secondary/60 p-4 text-sm"><PartyPopper className="mr-2 inline size-4 text-primary" />You've kept {Math.round(100-pct)}% of your plan available. That's breathing room.</div></div>
      <div className="glass-card flex flex-col p-6"><p className="eyebrow">Purchase Pal</p><h2 className="mt-2 text-2xl font-bold">A second thought, right when you need it.</h2><p className="mt-3 flex-1 text-base leading-7 text-muted-foreground/90">Share an item or photo. Your Pal weighs it against your plan and recent spending.</p><Button className="mt-6" asChild><Link to="/purchase-pal"><MessageCircle/>Start a conversation</Link></Button></div>
    </motion.section>
    <motion.section className="metallic-card p-6 sm:p-8" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.6 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Category pulse</p>
          <h2 className="mt-2 text-2xl font-bold">How your month is taking shape</h2>
        </div>
        <Button variant="link" asChild><Link to="/budget">Adjust plan <ArrowRight/></Link></Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedCategories.map((c) => {

          const used = c.used;
          const p = Number(c.target_amount) ? Math.min((used / Number(c.target_amount)) * 100, 100) : 0;
          const isHovered = hoveredId === c.id;
          const hasHover = hoveredId !== null;
          return (
            <motion.div
              key={c.id}
              layout
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelectedCategory(c)}
              animate={{
                scale: isHovered ? 1.06 : hasHover ? 0.96 : 1,
                zIndex: isHovered ? 10 : 1,
              }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="glass-control cursor-pointer rounded-2xl p-5"
            >
              <div className="flex justify-between">
                <b>{c.name}</b>
                <span className="text-sm text-muted-foreground">{Math.round(p)}%</span>
              </div>
              <AnimatedProgress value={p} className="mt-4 h-2" />
              <p className="mt-3 text-sm text-muted-foreground">{money(used)} of {money(Number(c.target_amount))}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.section>

    <Dialog open={!!selectedCategory} onOpenChange={(open) => !open && setSelectedCategory(null)}>
      <DialogContent className="max-w-md bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>{selectedCategory?.name}</DialogTitle>
          <DialogDescription>
            {selectedTx.length} purchase{selectedTx.length === 1 ? "" : "s"} this month
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {selectedTx.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No spending in this category yet.</p>
          ) : (
            <ul className="space-y-3">
              {selectedTx.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-4 rounded-xl bg-secondary/50 p-3">
                  <div>
                    <p className="font-medium">{t.item_name}</p>
                    {t.merchant && <p className="text-xs text-muted-foreground">{t.merchant}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(`${t.spent_on}T12:00:00`).toLocaleDateString()}</p>
                  </div>
                  <span className="shrink-0 font-semibold">{money(Number(t.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>
}



function AnimatedMoney({ value }: { value: number }) {
  const v = useMotionValue(0);
  const spring = useSpring(v, { stiffness: 90, damping: 15 });
  const display = useTransform(spring, (n) => money(Math.round(n)));
  useEffect(() => { v.set(value); }, [value, v]);
  return <motion.span>{display}</motion.span>;
}

function AnimatedProgress({ value, className }: { value: number; className?: string }) {
  const v = useMotionValue(0);
  const spring = useSpring(v, { stiffness: 90, damping: 15 });
  const width = useTransform(spring, (n) => `${n}%`);
  useEffect(() => { v.set(value); }, [value, v]);
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-secondary", className)}>
      <motion.div className="h-full rounded-full bg-primary" style={{ width }} />
    </div>
  );
}
