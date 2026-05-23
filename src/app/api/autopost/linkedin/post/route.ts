import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { caption, userId, imageBase64 } = await request.json();

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: connection } = await supabase.from("social_connections").select("*").eq("user_id", userId).eq("platform", "linkedin").single();
    if (!connection) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    if (expiresAt < new Date() && connection.refresh_token) {
      const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: connection.refresh_token, client_id: process.env.LINKEDIN_CLIENT_ID!, client_secret: process.env.LINKEDIN_CLIENT_SECRET! }),
      }).then(r => r.json());
      if (res.error) return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
      accessToken = res.access_token;
      await supabase.from("social_connections").update({ access_token: res.access_token, refresh_token: res.refresh_token || connection.refresh_token, expires_at: new Date(Date.now() + res.expires_in * 1000).toISOString() }).eq("id", connection.id);
    }

    // THE BYPASS: Put base64 directly in the payload. No asset upload required!
    let mediaPayload: any = undefined;

    if (imageBase64) {
      // Strip the "data:image/png;base64," prefix if it exists
      const cleanBase64 = imageBase64.includes("base64,") ? imageBase64.split("base64,")[1] : imageBase64;
      
      mediaPayload = [
        {
          status: "READY",
          media: `data:image/png;base64,${cleanBase64}`,
          title: { text: "CodeToPost" },
        }
      ];
    }

    const postBody = {
      author: `urn:li:person:${connection.platform_user_id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption },
          shareMediaCategory: imageBase64 ? "RICH_MEDIA" : "NONE",
          media: mediaPayload,
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errData = await postResponse.json();
      return NextResponse.json({ error: errData.message || "Failed" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}