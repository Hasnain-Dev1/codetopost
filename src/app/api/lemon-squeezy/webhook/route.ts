import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers.get("x-signature") as string;

  const hmac = crypto.createHmac("sha256", secret || "");
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  if (digest !== signature) return NextResponse.json({ error: "Invalid" }, { status: 401 });

  const event = JSON.parse(rawBody);

  if (event.meta.event_name === "subscription_created" || event.meta.event_name === "subscription_updated") {
    const userId = event.meta.custom_data?.user_id;
    const status = event.data.attributes.status;

    if (userId && status === "active") {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabase.from("users").update({ is_pro: true }).eq("id", userId); // Change column names if yours are different
    }
  }

  if (event.meta.event_name === "subscription_cancelled" || event.meta.event_name === "subscription_expired") {
    const userId = event.meta.custom_data?.user_id;
    if (userId) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabase.from("users").update({ is_pro: false }).eq("id", userId);
    }
  }

  return NextResponse.json({ received: true });
}