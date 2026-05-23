import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { caption, userId, imageBase64 } = await request.json();

    // Init Supabase Client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: connection } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "linkedin")
      .single();
      
    if (!connection) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    // 1. FIX: Correct Token Refresh Endpoint URL
    if (expiresAt < new Date() && connection.refresh_token) {
      const res = await fetch("https://linkedin.com", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ 
          grant_type: "refresh_token", 
          refresh_token: connection.refresh_token, 
          client_id: process.env.LINKEDIN_CLIENT_ID!, 
          client_secret: process.env.LINKEDIN_CLIENT_SECRET! 
        }),
      }).then(r => r.json());
      
      if (res.error) return NextResponse.json({ error: "Refresh failed", details: res }, { status: 401 });
      
      accessToken = res.access_token;
      await supabase
        .from("social_connections")
        .update({ 
          access_token: res.access_token, 
          refresh_token: res.refresh_token || connection.refresh_token, 
          expires_at: new Date(Date.now() + res.expires_in * 1000).toISOString() 
        })
        .eq("id", connection.id);
    }

    const linkedinHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    };

    let mediaAssetUrn: string | undefined = undefined;

    // 2. Process and Upload Base64 Data Stream Safely
    if (imageBase64) {
      try {
        // Safe string parsing for Vercel Serverless environment
        const cleanBase64 = imageBase64.includes("base64,") 
          ? imageBase64.split("base64,")[1] 
          : imageBase64;
          
        const imageBuffer = Buffer.from(cleanBase64, "base64");

        // STEP A: Register Asset via the Modern /v2/images API
        const registerRes = await fetch("https://linkedin.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...linkedinHeaders },
          body: JSON.stringify({
            initializeUploadRequest: {
              owner: `urn:li:person:${connection.platform_user_id}`
            }
          }),
        });

        const registerData = await registerRes.json();
        
        if (!registerRes.ok) {
          return NextResponse.json({ error: "Asset registration failed", details: registerData }, { status: registerRes.status });
        }

        const uploadUrl = registerData.value.uploadUrl;
        mediaAssetUrn = registerData.value.image; // This gives the "urn:li:image:..."

        // STEP B: Upload the binary data buffer payload via PUT
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          body: imageBuffer,
        });

        if (!uploadRes.ok) {
          return NextResponse.json({ error: "Binary payload stream rejected by LinkedIn upload node." }, { status: uploadRes.status });
        }
      } catch (uploadError: any) {
        return NextResponse.json({ error: "Internal buffer formatting crashed", details: uploadError.message }, { status: 500 });
      }
    }

    // 3. FIX: Construct Working UGC Post Payload
    const postBody = {
      author: `urn:li:person:${connection.platform_user_id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { 
            text: caption 
          },
          shareMediaCategory: mediaAssetUrn ? "IMAGE" : "NONE",
          media: mediaAssetUrn ? [
            {
              status: "READY",
              media: mediaAssetUrn,
              title: { 
                text: "CodeToPost Snippet" 
              }
            }
          ] : []
        },
      },
      visibility: { 
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" 
      },
    };

    // STEP C: Publish directly to the UGC Feed URL
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...linkedinHeaders },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errData = await postResponse.json();
      return NextResponse.json({ error: "UGC Feed submission failed", details: errData }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Unhandled global route failure", message: err.message }, { status: 500 });
  }
}
