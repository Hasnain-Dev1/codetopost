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

    let mediaAssetId: string | undefined;

    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const sizeKB = Math.round(imageBuffer.byteLength / 1024);

        // STEP 1
        const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
          body: JSON.stringify({ registerUploadRequest: { recipes: ["urn:li:digitalmediaRecipe:feedshare-image"], owner: `urn:li:person:${connection.platform_user_id}`, serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }] } }),
        });
        
        const registerData = await registerRes.json();
        
        if (!registerData.value) {
          const errString = JSON.stringify(registerData).substring(0, 200);
          return NextResponse.json({ error: `Step 1 Failed: ${errString}` }, { status: 500 });
        }

        const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
        mediaAssetId = registerData.value.asset;

        // STEP 2 (Using jpeg content-type to bypass strict checks)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg", Authorization: `Bearer ${accessToken}` },
          body: imageBuffer,
        });

        if (!uploadRes.ok) {
          return NextResponse.json({ error: `Step 2 Failed: Status ${uploadRes.status}, Image Size: ${sizeKB}KB` }, { status: 500 });
        }

      } catch (err: any) {
        return NextResponse.json({ error: `Step 1 Catch: ${err.message}` }, { status: 500 });
      }
    }

    if (mediaAssetId) await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 3
    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        author: `urn:li:person:${connection.platform_user_id}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: caption },
            shareMediaCategory: mediaAssetId ? "IMAGE" : "NONE",
            ...(mediaAssetId && { media: [{ status: "READY", description: { text: "Code" }, media: mediaAssetId, title: { text: "Code" } }] }),
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });

    if (!postRes.ok) {
      const errData = await postRes.json();
      return NextResponse.json({ error: `Step 3 Failed: ${errData.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: `Final Catch: ${err.message}` }, { status: 500 });
  }
}