import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, CircleDollarSign } from "lucide-react";
import { useState } from "react";
import { useFinance } from "@/components/finance/use-finance";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/budget")({
  component: BudgetPage,
  head: () => ({
    meta: [
      { title: "Monthly budget — Buy or Bye" },
      { name: "description", content: "Choose spending categories, set amounts, and shape a monthly budget that fits your life." },
      { property: "og:title", content: "Monthly budget — Buy or Bye" },
      { property: "og:description", content: "Choose spending categories, set amounts, and shape a monthly budget that fits your life." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
function BudgetPage() { const { budget,categories,reload,loading }=useFinance(); const [open,setOpen]=useState<string|null>(null); const [saving,setSaving]=useState(false); const total=categories.reduce((s,c)=>s+Number(c.target_amount),0);
 const update=async(id:string,value:string)=>{setSaving(true); await supabase.from("budget_categories").update({target_amount:Number(value)||0}).eq("id",id); await reload(); setSaving(false)};
  return <div className="mx-auto max-w-5xl space-y-7"><div><p className="eyebrow">Monthly budget</p><h1 className="mt-2 text-4xl font-bold">Give each dollar a gentle direction.</h1><p className="mt-3 text-lg text-muted-foreground/90">Select a category to see examples and adjust its amount.</p></div>
 <div className="glass-card flex flex-wrap items-center justify-between gap-5 p-6"><div className="flex items-center gap-4"><div className="rounded-2xl bg-accent p-3"><CircleDollarSign/></div><div><p className="text-sm text-muted-foreground">Planned across categories</p><p className="text-3xl font-display font-bold">{money(total)}</p></div></div><div className="text-right text-sm text-muted-foreground">Monthly goal<br/><b className="text-foreground">{money(Number(budget?.target_amount||0))}</b></div></div>
 <div className="grid gap-4 sm:grid-cols-2">{categories.map(c=><div key={c.id} className={`glass-card overflow-hidden transition ${open===c.id?'ring-2 ring-primary/25':''}`}><button className="glass-control flex w-full items-center justify-between border-0 p-5 text-left shadow-none" onClick={()=>setOpen(open===c.id?null:c.id)}><div><p className="text-lg font-bold">{c.name}</p><p className="text-sm text-muted-foreground">{money(Number(c.target_amount))} / month</p></div><ChevronDown className={`transition ${open===c.id?'rotate-180':''}`}/></button>{open===c.id&&<div className="border-t border-border/60 p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Examples</p><div className="mt-3 flex flex-wrap gap-2">{c.examples.map(x=><span key={x} className="rounded-full bg-secondary px-3 py-1.5 text-sm">{x}</span>)}</div><label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly amount</label><Input className="mt-2 rounded-full bg-white" type="number" defaultValue={Number(c.target_amount)} onBlur={e=>void update(c.id,e.target.value)}/></div>}</div>)}</div>
 <div className="flex items-center justify-between border-t pt-5 text-sm"><span className="text-muted-foreground">{saving?'Saving your plan…':loading?'Loading…':'Changes save automatically.'}</span><Link to="/app" className="flex items-center gap-2 font-semibold text-primary underline underline-offset-4">Back to monthly overview <ArrowRight className="size-4"/></Link></div></div> }
