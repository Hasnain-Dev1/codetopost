import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { caption, userId } = await request.json();

    // Get user's LinkedIn tokens
    const supabase = await createClient();
    const { data: connection, error: dbError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "linkedin")
      .single();

    if (dbError || !connection) {
      return NextResponse.json({ error: "LinkedIn not connected" }, { status: 400 });
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    if (expiresAt < new Date() && connection.refresh_token) {
      const refreshResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: connection.refresh_token,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      });

      const newTokens = await refreshResponse.json();
      if (newTokens.error) {
        return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
      }

      accessToken = newTokens.access_token;

      await supabase
        .from("social_connections")
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || connection.refresh_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
    }

    // Create LinkedIn post
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${connection.platform_user_id}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: caption,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json();
      console.error("LinkedIn post error:", errorData);
      return NextResponse.json({ error: "Failed to create post" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LinkedIn post error:", error);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}