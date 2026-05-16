import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ToolUI from "./ToolUI";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("generations_left, is_pro")
    .single();

  const credits = profile?.is_pro ? 999 : (profile?.generations_left || 0);

  // Added isPro state here
  return <ToolUI initialGenerationsLeft={credits} userId={user.id} isPro={profile?.is_pro || false} />;
}