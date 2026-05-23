import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { caption, userId, imageBase64 } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: connection, error: dbError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "linkedin")
      .single();

    if (dbError || !connection) {
      return NextResponse.json({ error: "LinkedIn not connected" }, { status: 400 });
    }

    let accessToken = connection.access_token;
    const expiresAt = new Date(connection.expires_at);

    if (expiresAt < new Date() && connection.refresh_token) {
      const refreshResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

    const linkedinHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
    };

    let mediaAssetId: string | undefined;

    // STEP 1 & 2: KEEP OUR WORKING UPLOAD
    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...linkedinHeaders },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: `urn:li:person:${connection.platform_user_id}`,
              supportedUploadMechanisms: ["SYNCHRONOUS_UPLOAD"],
              serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
            },
          }),
        });

        const registerData = await registerRes.json();

        if (registerData.value) {
          const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
          mediaAssetId = registerData.value.asset;

          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/png", "Authorization": `Bearer ${accessToken}` },
            body: imageBuffer,
          });

          if (!uploadRes.ok) {
            console.error("Upload failed:", uploadRes.status);
            mediaAssetId = undefined; // Don't send broken image
          }
        } else {
          console.error("Register failed:", JSON.stringify(registerData));
          mediaAssetId = undefined;
        }
      } catch (imgErr: any) {
        console.error("Upload error:", imgErr.message);
        mediaAssetId = undefined;
      }
    }

    // WAIT FOR LINKEDIN TO PROCESS
    if (mediaAssetId) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 3: USE THE NEWER, CLEANER POST API FORMAT
    const postBody: any = {
      author: `urn:li:person:${connection.platform_user_id}`,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    };

    // This is the new, simpler way to attach media!
    if (mediaAssetId) {
      postBody.content = {
        media: {
          title: "CodeToPost Image",
          id: mediaAssetId,
        },
      };
    }

    const postResponse = await fetch("https://api.linkedin.com/v2/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...linkedinHeaders },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json();
      console.error("Post Failed:", JSON.stringify(errorData));
      return NextResponse.json({ error: errorData.message || "Failed to create post" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("LinkedIn post error:", error);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}