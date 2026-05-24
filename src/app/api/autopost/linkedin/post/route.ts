import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    // 1. Read FormData instead of JSON (fixes the 1MB limit crash)
    const formData = await request.formData();
    const caption = formData.get("caption") as string;
    const userId = formData.get("userId") as string;
    const imageBase64 = formData.get("imageBase64") as string | null;

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: connection } = await supabase.from("social_connections").select("*").eq("user_id", userId).eq("platform", "linkedin").single();
    
    if (!connection) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    // 2. Refresh Token if expired
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

    // 3. THE OFFICIAL V2 3-STEP UPLOAD (V1 is dead)
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // STEP A: Tell LinkedIn we want to upload an image
        const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${accessToken}`, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: `urn:li:person:${connection.platform_user_id}`,
              serviceRelationships: [
                { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }
              ]
            }
          })
        });

        const registerData = await registerRes.json();
        
        if (!registerData.value) {
          console.error("LinkedIn Step 1 Failed:", JSON.stringify(registerData));
          throw new Error("Failed to register upload with LinkedIn");
        }

        // STEP B: Get the upload URL and the Asset URN
        const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
        mediaId = registerData.value.asset; // This is already a proper URN!

        // STEP C: Upload the actual image file to the URL LinkedIn gave us
        const uploadBinaryRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: imageBuffer,
        });

        if (!uploadBinaryRes.ok) {
          throw new Error("Failed to upload image binary to LinkedIn");
        }

        console.log("V2 Upload Success! Asset URN:", mediaId);
      } catch (err: any) {
        console.error("Upload Error:", err.message);
        return NextResponse.json({ error: "Image upload failed: " + err.message }, { status: 500 });
      }
    }

    // 4. CREATE THE POST
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
              media: mediaId, // Use the URN directly from Step B
              title: { text: "Code Snippet" }
            }
          ] : []
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    // Use the official v2 endpoint
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errData = await postResponse.json();
      console.error("LinkedIn Post Failed:", JSON.stringify(errData));
      return NextResponse.json({ error: errData.message || "Post failed" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}