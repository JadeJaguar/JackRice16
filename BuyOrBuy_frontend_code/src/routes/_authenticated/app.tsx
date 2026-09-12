import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, PartyPopper, Plus, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useFinance } from "@/components/finance/use-finance";
import { money } from "@/lib/finance";
import { Button } from "@/components/ui/button";
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
  const spent = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const target = Number(budget?.target_amount ?? 0);
  const remaining = Math.max(target - spent, 0);
  const pct = target ? Math.min((spent / target) * 100, 100) : 0;
  if (loading) return <div className="glass-card h-72 animate-pulse" />;
  return <div className="space-y-6">
     <motion.section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}><div><p className="eyebrow">Your monthly overview</p><h1 className="mt-2 text-4xl font-bold sm:text-5xl">For a clear view of your money.</h1><p className="mt-3 text-lg text-muted-foreground/90">Progress, not pressure. Small choices build a steadier month.</p></div><Button asChild><Link to="/tracker"><Plus/>Log spending</Link></Button></motion.section>
    {error && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    <motion.section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55 }}>
      <div className="glass-card p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Still available</p><p className="mt-1 text-5xl font-display font-bold"><AnimatedMoney value={remaining} /></p></div><div className="rounded-2xl bg-accent p-3"><Sparkles className="text-primary"/></div></div><AnimatedProgress value={pct} className="mt-8 h-3"/><div className="mt-3 flex justify-between text-sm"><span>{money(spent)} spent</span><span>{money(target)} planned</span></div><div className="mt-7 rounded-2xl bg-secondary/60 p-4 text-sm"><PartyPopper className="mr-2 inline size-4 text-primary" />You've kept {Math.round(100-pct)}% of your plan available. That's breathing room.</div></div>
      <div className="glass-card flex flex-col p-6"><p className="eyebrow">Purchase Pal</p><h2 className="mt-2 text-2xl font-bold">A second thought, right when you need it.</h2><p className="mt-3 flex-1 text-base leading-7 text-muted-foreground/90">Share an item or photo. Your Pal weighs it against your plan and recent spending.</p><Button className="mt-6" asChild><Link to="/purchase-pal"><MessageCircle/>Start a conversation</Link></Button></div>
    </motion.section>
    <motion.section className="glass-card p-6 sm:p-8" initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.6 }}><div className="flex items-center justify-between"><div><p className="eyebrow">Category pulse</p><h2 className="mt-2 text-2xl font-bold">How your month is taking shape</h2></div><Button variant="link" asChild><Link to="/budget">Adjust plan <ArrowRight/></Link></Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map(c=>{const used=transactions.filter(t=>t.category_id===c.id).reduce((s,t)=>s+Number(t.amount),0); const p=Number(c.target_amount)?Math.min(used/Number(c.target_amount)*100,100):0; return <div key={c.id} className="glass-control rounded-2xl p-5"><div className="flex justify-between"><b>{c.name}</b><span className="text-sm text-muted-foreground">{Math.round(p)}%</span></div><AnimatedProgress value={p} className="mt-4 h-2"/><p className="mt-3 text-sm text-muted-foreground">{money(used)} of {money(Number(c.target_amount))}</p></div>})}</div></motion.section>
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
