import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
function BudgetPage() { const { budget,categories,reload,loading }=useFinance(); const [saving,setSaving]=useState(false); const total=categories.reduce((s,c)=>s+Number(c.target_amount),0);
 const categoryRowRef=useRef<HTMLDivElement>(null); const scrollFrameRef=useRef<number | null>(null); const scrollSpeedRef=useRef(0);
 useEffect(()=>()=>{if(scrollFrameRef.current!==null) window.cancelAnimationFrame(scrollFrameRef.current)},[]);
 const stopEdgeScroll=()=>{scrollSpeedRef.current=0;if(scrollFrameRef.current!==null){window.cancelAnimationFrame(scrollFrameRef.current);scrollFrameRef.current=null}};
 const runEdgeScroll=()=>{const row=categoryRowRef.current;if(!row||scrollSpeedRef.current===0){scrollFrameRef.current=null;return}row.scrollLeft+=scrollSpeedRef.current;scrollFrameRef.current=window.requestAnimationFrame(runEdgeScroll)};
 const handleCategoryMouseMove=(event:ReactMouseEvent<HTMLDivElement>)=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const bounds=event.currentTarget.getBoundingClientRect();const edge=Math.min(140,bounds.width*.2);const position=event.clientX-bounds.left;let speed=0;if(position<edge)speed=-10*(1-position/edge);else if(position>bounds.width-edge)speed=10*(1-(bounds.width-position)/edge);scrollSpeedRef.current=speed;if(speed!==0&&scrollFrameRef.current===null)scrollFrameRef.current=window.requestAnimationFrame(runEdgeScroll);else if(speed===0)stopEdgeScroll()};
 const update=async(id:string,value:string)=>{setSaving(true); await supabase.from("budget_categories").update({target_amount:Number(value)||0}).eq("id",id); await reload(); setSaving(false)};
  return <div className="mx-auto max-w-5xl space-y-7"><div><p className="eyebrow">Monthly budget</p><h1 className="mt-2 text-4xl font-bold">Give each dollar a gentle direction.</h1><p className="mt-3 text-lg text-muted-foreground/90">Select a category to see examples and adjust its amount.</p></div>
 <div className="glass-card flex flex-wrap items-center justify-between gap-5 p-6"><div className="flex items-center gap-4"><div className="rounded-2xl bg-accent p-3"><CircleDollarSign/></div><div><p className="text-sm text-muted-foreground">Planned across categories</p><p className="text-3xl font-display font-bold">{money(total)}</p></div></div><div className="text-right text-sm text-muted-foreground">Monthly goal<br/><b className="text-foreground">{money(Number(budget?.target_amount||0))}</b></div></div>
 <div ref={categoryRowRef} onMouseMove={handleCategoryMouseMove} onMouseLeave={stopEdgeScroll} className="flex gap-4 overflow-x-auto overscroll-x-contain pb-4 pt-1">{categories.map(c=><div key={c.id} className="glass-card flex w-72 shrink-0 flex-col p-5 transition-transform duration-200 ease-out hover:scale-105"><div><p className="text-lg font-bold">{c.name}</p><p className="text-sm text-muted-foreground">{money(Number(c.target_amount))} / month</p></div><div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Examples</p><div className="mt-2 flex flex-wrap gap-2">{c.examples.map(x=><span key={x} className="rounded-full bg-secondary px-3 py-1.5 text-sm">{x}</span>)}</div></div><label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly amount</label><Input className="mt-2 rounded-full bg-white" type="number" defaultValue={Number(c.target_amount)} onBlur={e=>void update(c.id,e.target.value)}/></div>)}</div>
 <div className="flex items-center justify-between border-t pt-5 text-sm"><span className="text-muted-foreground">{saving?'Saving your plan…':loading?'Loading…':'Changes save automatically.'}</span><Link to="/app" className="flex items-center gap-2 font-semibold text-primary underline underline-offset-4">Back to monthly overview <ArrowRight className="size-4"/></Link></div></div> }
