import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, HeartHandshake, Leaf, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PointerBackground } from "@/components/finance/pointer-background";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "motion/react";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Buy or Bye — A calmer way to decide" },
      { name: "description", content: "Set a monthly budget, track spending, and talk through purchases before you buy." },
      { property: "og:title", content: "Buy or Bye — A calmer way to decide" },
      { property: "og:description", content: "Set a monthly budget, track spending, and talk through purchases before you buy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const navigate = useNavigate();
  const [showBottomFade, setShowBottomFade] = useState(true);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: "/app" }); }); }, [navigate]);
  useEffect(() => {
    const onScroll = () => setShowBottomFade(window.scrollY < 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const signIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/app` });
    if (!result.redirected && !result.error) void navigate({ to: "/app" });
  };
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <PointerBackground mode="absolute" />
      <div className="absolute -left-20 top-20 size-72 rounded-full bg-[#bddcbf]/45 blur-3xl" />
      <div className="absolute -right-16 top-0 size-96 rounded-full bg-[#b9def3]/50 blur-3xl" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif' }}>Buy or Bye</div>
        <Button variant="soft" onClick={signIn}>Sign in</Button>
      </header>
      <main className="relative mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-14 px-6 pb-16 lg:grid-cols-[1.05fr_.95fr]">
        <motion.section className="w-full py-10" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: "easeOut" }}>
          <div className="eyebrow mb-5 flex items-center gap-2"><Leaf className="size-4" />Money decisions, made gentler</div>
          <h1 className="text-5xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl">Keep what matters.<br/><span className="text-primary">Skip what doesn't.</span></h1>
          <p className="mt-7 max-w-xl text-xl leading-9 text-muted-foreground/90">Set a budget that fits your life, see your progress, and talk through purchases before they become regrets.</p>
          <div className="mt-8 flex flex-wrap gap-4"><Button size="lg" onClick={signIn}>Continue with Google <ArrowRight /></Button><div className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4 text-primary" />Private by default</div></div>
          <button onClick={signIn} className="mt-4 text-sm text-muted-foreground underline decoration-primary/50 underline-offset-4">Are you new here? Sign up with Google</button>
          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {[['Plan','Shape a realistic month'],['Track','See every dollar clearly'],['Decide','Ask before you buy']].map(([a,b])=><div key={a} className="glass-control rounded-2xl p-4"><p className="font-bold">{a}</p><p className="mt-1 text-xs text-muted-foreground">{b}</p></div>)}
          </div>
        </motion.section>
        <motion.section className="glass-card relative mx-auto w-full max-w-lg p-5 sm:p-7" initial={{ opacity: 0, y: 32, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, delay: 0.08, ease: "easeOut" }}>
          <div className="flex items-center justify-between"><div><p className="eyebrow">Your calm money space</p><h2 className="mt-2 text-2xl font-bold">A month in balance</h2></div><div className="grid size-12 place-items-center rounded-2xl bg-secondary"><Sparkles className="text-primary" /></div></div>
          <div className="mt-8 rounded-3xl bg-[#e8f2e7] p-6"><div className="flex justify-between text-sm"><span>Monthly plan</span><b>$1,440</b></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white"><div className="h-full w-[62%] rounded-full bg-primary" /></div><p className="mt-3 text-sm text-muted-foreground">62% still available — you're creating breathing room.</p></div>
          <div className="mt-4 grid grid-cols-2 gap-4"><div className="rounded-3xl bg-[#e6f2f9] p-5"><HeartHandshake className="mb-8 text-[#3d82a4]"/><p className="text-sm text-muted-foreground">Purchase Pal</p><p className="font-bold">Think it through</p></div><div className="rounded-3xl bg-white p-5"><p className="text-sm text-muted-foreground">This month</p><p className="mt-1 text-3xl font-display font-bold">$548</p><p className="mt-8 text-xs text-primary">On track and aware</p></div></div>
        </motion.section>
      </main>
      <div aria-hidden className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 h-24 bg-gradient-to-t from-background to-transparent transition-opacity duration-700 ${showBottomFade ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
