import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Heart, LayoutDashboard, LogOut, MessageCircle, ReceiptText, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { CustomCursor } from "@/components/finance/custom-cursor";
import { PointerBackground } from "@/components/finance/pointer-background";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

const links = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/budget", label: "Monthly budget", icon: WalletCards },
  { to: "/tracker", label: "Expenses Tracker", icon: ReceiptText },
  { to: "/purchase-pal", label: "Purchase Pal", icon: MessageCircle },
] as const;

const FADE_ONLY_PATHS = ["/budget", "/tracker", "/purchase-pal"];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fadeOnly = FADE_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const isTracker = path === "/tracker" || path.startsWith("/tracker/");
  const pagePadding = isTracker ? "px-8 sm:px-14 lg:px-24" : "px-6 sm:px-10 lg:px-16";
  const [showBottomFade, setShowBottomFade] = useState(true);
  useEffect(() => {
    const onScroll = () => setShowBottomFade(window.scrollY < 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="relative isolate min-h-screen cursor-none overflow-hidden bg-background text-foreground">
      <CustomCursor />
      <PointerBackground />
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <Link to="/app" className="mr-auto flex items-center gap-2.5 font-display text-xl font-semibold">
            Buy or Bye
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <Button key={to} variant={path.startsWith(to) ? "soft" : "ghost"} className={`nav-outline ${path.startsWith(to) ? "nav-outline-active" : ""}`} asChild>
                <Link to={to}><Icon />{label}</Link>
              </Button>
            ))}
          </div>
          <Button variant="ghost" className="nav-outline ml-1" aria-label="Log out" onClick={() => supabase.auth.signOut()}><LogOut /><span className="hidden sm:inline">Log out</span></Button>
        </div>
      </header>
      {fadeOnly ? (
        <main key={path} className={`relative z-10 mx-auto max-w-[1500px] ${pagePadding} pb-24 pt-6 sm:pt-9`}>{children}</main>
      ) : (
        <motion.main
          key={path}
          className={`relative z-10 mx-auto max-w-[1500px] ${pagePadding} pb-24 pt-6 sm:pt-9`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >{children}</motion.main>
      )}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-border/70 bg-background/90 p-2 shadow-lg backdrop-blur-xl md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={`nav-outline flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] ${path.startsWith(to) ? "nav-outline-active bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>
            <Icon className="size-5" />{label === "Monthly budget" ? "Budget" : label === "Purchase Pal" ? "Pal" : label}
          </Link>
        ))}
      </nav>
      <div aria-hidden className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 h-24 bg-gradient-to-t from-background to-transparent transition-opacity duration-700 ${showBottomFade ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
