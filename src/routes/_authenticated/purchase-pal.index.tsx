import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/purchase-pal/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    const { data: latest } = await supabase
      .from("purchase_threads")
      .select("id")
      .eq("user_id", data.user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      throw redirect({ to: "/purchase-pal/$threadId", params: { threadId: latest.id } });
    }
    const made = await supabase
      .from("purchase_threads")
      .insert({ user_id: data.user.id, title: "New purchase thought" })
      .select()
      .single();
    if (made.error) throw made.error;
    throw redirect({ to: "/purchase-pal/$threadId", params: { threadId: made.data.id } });
  },
  component: () => null,
  head: () => ({
    meta: [
      { title: "Purchase Pal — Buy or Bye" },
      { name: "description", content: "Start a new purchase conversation with your budget-aware assistant." },
      { property: "og:title", content: "Purchase Pal — Buy or Bye" },
      { property: "og:description", content: "Start a new purchase conversation with your budget-aware assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
