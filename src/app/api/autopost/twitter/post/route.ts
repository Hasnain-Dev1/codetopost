import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Changed to Admin client

export async function POST(request: NextRequest) {
  try {
    const { caption, userId, imageBase64 } = await request.json();

    // Use ADMIN client (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: connection, error: dbError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "twitter")
      .single();

    if (dbError || !connection) {
      return NextResponse.json({ error: "Twitter not connected" }, { status: 400 });
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    if (expiresAt < new Date()) {
      const refreshResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: connection.refresh_token,
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
          refresh_token: newTokens.refresh_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
    }

    // Upload media (Only works on Twitter Basic $100/mo plan)
    let mediaId: string | undefined;

    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const uploadResponse = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: new URLSearchParams({
          media_data: base64Data,
        }),
      });

      const uploadData = await uploadResponse.json();
      
      if (uploadData.media_id_string) {
        mediaId = uploadData.media_id_string;
      } else {
        console.warn("Image upload failed (Requires Twitter Basic Plan). Posting text only.");
      }
    }

    // Post tweet
    const tweetBody: any = { text: caption };
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
    }

    const tweetResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData = await tweetResponse.json();

    if (tweetData.errors || !tweetData.data) {
      const errorMsg = tweetData.errors?.[0]?.message || "Failed to create tweet.";
      console.error("Tweet creation failed:", tweetData);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tweetId: tweetData.data.id,
      tweetUrl: `https://x.com/i/status/${tweetData.data.id}`
    });
  } catch (error) {
    console.error("Twitter post error:", error);
    return NextResponse.json({ error: "Failed to post tweet" }, { status: 500 });
  }
}