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
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    // 1. OAUTH REFRESH TOKEN CHECK
    if (expiresAt < new Date() && connection.refresh_token) {
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
        return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
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
    }

    let assetUrn: string | undefined;
    const authorUrn = `urn:li:person:${connection.platform_user_id}`;

    // 2. MODERN IMAGE UPLOAD PROCESS (REGISTER -> UPLOAD)
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // STEP A: Register the image asset intent
        const registerRes = await fetch(
          "https://linkedin.com",
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

        if (!registerRes.ok) {
          const regErr = await registerRes.text();
          console.error("LinkedIn Image Registration Failed:", regErr);
          return NextResponse.json({ error: "Image registration failed" }, { status: registerRes.status });
        }

        const registerData = await registerRes.json();
        const uploadUrl = registerData.value.uploadUrl;
        assetUrn = registerData.value.image; // e.g., urn:li:image:12345

        // STEP B: Upload the binary buffer via PUT to the given upload URL
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "image/png", // Adjust if accepting jpegs dynamically
          },
          body: imageBuffer,
        });

        if (!uploadRes.ok) {
          console.error("LinkedIn Binary File Upload Failed status:", uploadRes.status);
          return NextResponse.json({ error: "Binary image transfer failed" }, { status: uploadRes.status });
        }
        
        console.log("LinkedIn Image Upload Success. Asset URN:", assetUrn);
      } catch (err: any) {
        console.error("Upload Logic Crashed:", err.message);
        return NextResponse.json({ error: "Upload crashed internally" }, { status: 500 });
      }
    }

    // 3. POST PUBLISHING USING THE CONTEMPORARY /v2/posts API
    // Structuring content depending on whether an image was successfully attached
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

    const postResponse = await fetch("https://linkedin.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0", // Crucial protocol header for modern v2 restli endpoints
      },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errText = await postResponse.text();
      console.error("LinkedIn Post Creation Failed:", errText);
      return NextResponse.json({ error: "Post execution failed on LinkedIn side" }, { status: postResponse.status });
    }

    // Return the response headers if tracking post creation values
    const createdPostUrn = postResponse.headers.get("x-linkedin-id") || "Success";

    return NextResponse.json({ success: true, postId: createdPostUrn });
  } catch (err: any) {
    console.error("Global Error Route catch:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
