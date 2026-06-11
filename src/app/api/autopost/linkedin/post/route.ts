import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      const res = await fetch(
        "https://www.linkedin.com/oauth/v2/accessToken",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: connection.refresh_token,
            client_id: process.env.LINKEDIN_CLIENT_ID!,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          }),
        }
      ).then((r) => r.json());

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
      console.log("[LinkedIn] Token refreshed successfully");
    }

    const authorUrn = `urn:li:person:${connection.platform_user_id}`;
    let assetUrn: string | undefined;

    // 2. IMAGE UPLOAD (REGISTER → UPLOAD BINARY)
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        console.log("[LinkedIn] Image buffer size:", (imageBuffer.length / 1024 / 1024).toFixed(2), "MB");

        // STEP A: Register upload intent
        const registerRes = await fetch(
          "https://api.linkedin.com/rest/images?action=initializeUpload",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              initializeUploadRequest: {
                owner: authorUrn,
              },
            }),
          }
        );

        const registerText = await registerRes.text();
        console.log("[LinkedIn] Register response status:", registerRes.status);
        console.log("[LinkedIn] Register response body:", registerText);

        if (!registerRes.ok) {
          console.error("[LinkedIn] Image registration failed:", registerText);
          return NextResponse.json(
            { error: "Image registration failed: " + registerText },
            { status: registerRes.status }
          );
        }

        const registerData = JSON.parse(registerText);

        if (!registerData.value?.uploadUrl || !registerData.value?.image) {
          console.error("[LinkedIn] Missing uploadUrl or image URN in response:", registerData);
          return NextResponse.json(
            { error: "Invalid registration response from LinkedIn" },
            { status: 500 }
          );
        }

        const uploadUrl = registerData.value.uploadUrl;
        assetUrn = registerData.value.image;
        console.log("[LinkedIn] Upload URL received, asset URN:", assetUrn);

        // STEP B: Upload binary image via PUT
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "image/png",
          },
          body: imageBuffer,
        });

        console.log("[LinkedIn] Binary upload status:", uploadRes.status);

        if (!uploadRes.ok) {
          const uploadErrText = await uploadRes.text();
          console.error("[LinkedIn] Binary upload failed:", uploadErrText);
          return NextResponse.json(
            { error: "Image upload failed: " + uploadErrText },
            { status: uploadRes.status }
          );
        }

        console.log("[LinkedIn] Image uploaded successfully");
      } catch (err: any) {
        console.error("[LinkedIn] Upload logic crashed:", err.message);
        return NextResponse.json(
          { error: "Image upload crashed: " + err.message },
          { status: 500 }
        );
      }
    } else {
      console.log("[LinkedIn] No image provided, posting text-only");
    }

    // 3. CREATE THE POST
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
    }

    console.log("[LinkedIn] Creating post...", JSON.stringify(postBody, null, 2));

    const postResponse = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202601",
      },
      body: JSON.stringify(postBody),
    });

    const postResponseText = await postResponse.text();
    console.log("[LinkedIn] Post response status:", postResponse.status);
    console.log("[LinkedIn] Post response body:", postResponseText);

    if (!postResponse.ok) {
      console.error("[LinkedIn] Post creation failed:", postResponseText);
      return NextResponse.json(
        { error: "Post failed: " + postResponseText },
        { status: postResponse.status }
      );
    }

    const createdPostUrn =
      postResponse.headers.get("x-linkedin-id") || "Success";

    console.log("[LinkedIn] Post created! URN:", createdPostUrn);

    return NextResponse.json({ success: true, postId: createdPostUrn });
  } catch (err: any) {
    console.error("[LinkedIn] Global error:", err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}