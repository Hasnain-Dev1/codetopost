import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper: wait ms
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  try {
    const { caption, userId, imageBase64 } = await request.json();

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

    if (!connection) {
      console.error("[LinkedIn] No connection found for user:", userId);
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    // 1. REFRESH TOKEN IF EXPIRED
    if (expiresAt < new Date() && connection.refresh_token) {
      console.log("[LinkedIn] Token expired, refreshing...");
      const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: connection.refresh_token,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      }).then((r) => r.json());

      if (res.error) {
        console.error("[LinkedIn] Refresh failed:", res.error_description || res.error);
        return NextResponse.json(
          { error: "Token refresh failed: " + (res.error_description || res.error) },
          { status: 401 }
        );
      }

      accessToken = res.access_token;
      await supabase
        .from("social_connections")
        .update({
          access_token: res.access_token,
          refresh_token: res.refresh_token || connection.refresh_token,
          expires_at: new Date(Date.now() + res.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
      console.log("[LinkedIn] Token refreshed");
    }

    const authorUrn = `urn:li:person:${connection.platform_user_id}`;
    let assetUrn: string | undefined;

    const API_HEADERS = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202601",
      "X-Restli-Protocol-Version": "2.0.0",
    };

    // 2. IMAGE UPLOAD
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        console.log("[LinkedIn] Image size:", (imageBuffer.length / 1024).toFixed(1), "KB");

        // STEP A: Register upload intent
        const registerRes = await fetch(
          "https://api.linkedin.com/rest/images?action=initializeUpload",
          {
            method: "POST",
            headers: API_HEADERS,
            body: JSON.stringify({
              initializeUploadRequest: {
                owner: authorUrn,
              },
            }),
          }
        );

        const registerText = await registerRes.text();
        console.log("[LinkedIn] Register status:", registerRes.status, "body:", registerText);

        if (!registerRes.ok) {
          return NextResponse.json(
            { error: "Image registration failed: " + registerText },
            { status: registerRes.status }
          );
        }

        const registerData = JSON.parse(registerText);

        if (!registerData.value?.uploadUrl || !registerData.value?.image) {
          console.error("[LinkedIn] Bad register response:", JSON.stringify(registerData));
          return NextResponse.json(
            { error: "Invalid registration response" },
            { status: 500 }
          );
        }

        const uploadUrl = registerData.value.uploadUrl;
        assetUrn = registerData.value.image;
        console.log("[LinkedIn] Got upload URL, asset URN:", assetUrn);

        // STEP B: Upload binary
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "image/png",
          },
          body: imageBuffer,
        });

        console.log("[LinkedIn] Upload status:", uploadRes.status);

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          console.error("[LinkedIn] Upload failed:", errText);
          return NextResponse.json(
            { error: "Image upload failed: " + errText },
            { status: uploadRes.status }
          );
        }

        // ⭐ STEP C: WAIT for LinkedIn to process the image
        console.log("[LinkedIn] Image uploaded, waiting 3s for processing...");
        await sleep(3000);
        console.log("[LinkedIn] Proceeding to create post");

      } catch (err: any) {
        console.error("[LinkedIn] Upload crashed:", err.message);
        return NextResponse.json(
          { error: "Image upload crashed: " + err.message },
          { status: 500 }
        );
      }
    }

    // 3. CREATE POST
    const postBody: any = {
      author: authorUrn,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    };

    if (assetUrn) {
      postBody.content = {
        media: {
          id: assetUrn,
        },
      };
      console.log("[LinkedIn] Attaching image URN:", assetUrn);
    }

    console.log("[LinkedIn] Creating post...");

    const postResponse = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify(postBody),
    });

    const postText = await postResponse.text();
    console.log("[LinkedIn] Post status:", postResponse.status, "body:", postText);

    if (!postResponse.ok) {
      return NextResponse.json(
        { error: "Post failed: " + postText },
        { status: postResponse.status }
      );
    }

    const postId = postResponse.headers.get("x-linkedin-id") || "Success";
    console.log("[LinkedIn] Post created! ID:", postId);

    return NextResponse.json({ success: true, postId });
  } catch (err: any) {
    console.error("[LinkedIn] Global error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}