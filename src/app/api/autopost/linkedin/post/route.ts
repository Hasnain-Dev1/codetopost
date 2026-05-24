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
        body: new URLSearchParams({ 
          grant_type: "refresh_token", 
          refresh_token: connection.refresh_token, 
          client_id: process.env.LINKEDIN_CLIENT_ID!, 
          client_secret: process.env.LINKEDIN_CLIENT_SECRET! 
        }),
      }).then(r => r.json());
      if (res.error) return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
      accessToken = res.access_token;
      await supabase.from("social_connections").update({
        access_token: res.access_token, 
        refresh_token: res.refresh_token || connection.refresh_token, 
        expires_at: new Date(Date.now() + res.expires_in * 1000).toISOString() 
      }).eq("id", connection.id);
    }

    let mediaId: string | undefined;

    // THE BULLETPROOF V1 UPLOAD
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // V1 UPLOAD - Rock solid, no asset queues, instant response
        const formData = new FormData();
        formData.append("file", new Blob([imageBuffer], { type: "image/png" }));

        const uploadRes = await fetch("https://api.linkedin.com/v1/media/upload", {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}` },
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (uploadData.media) {
          // V1 just returns a simple ID, not a URN. We must convert it to a URN
          mediaId = uploadData.media;
          console.log("V1 Upload Success! Media ID:", mediaId);
        } else {
          console.error("V1 Upload Failed:", JSON.stringify(uploadData));
          return NextResponse.json({ error: "Image upload failed" }, { status: uploadData.status || 500 });
        }
      } catch (err: any) {
        console.error("Upload Error:", err.message);
        return NextResponse.json({ error: "Upload crashed" }, { status: 500 });
      }
    }

    // POST USING UGC (With the V1 ID formatted as a URN)
    const postBody: any = {
      author: `urn:li:person:${connection.platform_user_id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: caption },
          shareMediaCategory: mediaId ? "IMAGE" : "NONE",
          media: mediaId ? [
            {
              status: "READY",
              media: `urn:li:media:${mediaId}`, // MUST BE A URN!
            }
          ] : []
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const postResponse = await fetch("https://api.linkedin.com/v1/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errData = await postResponse.json();
      return NextResponse.json({ error: errData.message || "Post failed" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}