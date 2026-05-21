import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabaseAdmin
      .from("social_connections")
      .select("platform")
      .eq("user_id", userId);

    const connections = data?.map((item: any) => item.platform) || [];

    return NextResponse.json({ connections });
  } catch (error) {
    return NextResponse.json({ connections: [] });
  }
}