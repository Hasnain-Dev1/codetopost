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
      if (newTokens.error) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
      accessToken = newTokens.access_token;

      await supabase.from("social_connections").update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || connection.refresh_token,
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      }).eq("id", connection.id);
    }

    const linkedinHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
    };

    let mediaAssetId: string | undefined;
    let imageUploadedSuccessfully = false;

    if (imageBase64) {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        console.log("=== LINKEDIN IMAGE DEBUG ===");
        console.log("1. Image Buffer Size (KB):", Math.round(imageBuffer.byteLength / 1024));

        // STEP 1: REGISTER
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
        console.log("2. Register Status:", registerRes.status);
        console.log("3. Register Response:", JSON.stringify(registerData));

        if (registerData.value) {
          const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
          mediaAssetId = registerData.value.asset;
          console.log("4. Got Asset ID:", mediaAssetId);
          console.log("5. Got Upload URL:", uploadUrl ? "Yes" : "No");

          // STEP 2: UPLOAD BINARY
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/png", "Authorization": `Bearer ${accessToken}` },
            body: imageBuffer,
          });

          console.log("6. Upload Status:", uploadRes.status, uploadRes.statusText);
          
          if (uploadRes.ok) {
            imageUploadedSuccessfully = true;
            console.log("7. SUCCESS: Image uploaded to LinkedIn servers!");
          } else {
            const uploadErrText = await uploadRes.text();
            console.log("7. FAILED: Upload error:", uploadErrText);
            mediaAssetId = undefined;
          }
        } else {
          console.log("4. FAILED: No upload URL in response!");
          mediaAssetId = undefined;
        }
      } catch (imgErr: any) {
        console.log("CATCH ERROR:", imgErr.message);
        mediaAssetId = undefined;
      }
    }

    console.log("8. Final Asset ID to use:", mediaAssetId);
    console.log("============================");

    // WAIT
    if (mediaAssetId) {
      console.log("9. Waiting 4 seconds...");
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    // STEP 3: POST
    const postBody: any = {
      author: `urn:li:person:${connection.platform_user_id}`,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
    };

    if (mediaAssetId) {
      postBody.content = { media: { title: "CodeToPost Image", id: mediaAssetId } };
    }

    const postResponse = await fetch("https://api.linkedin.com/v2/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...linkedinHeaders },
      body: JSON.stringify(postBody),
    });

    console.log("10. Post Status:", postResponse.status);
    
    const postData = await postResponse.text();
    console.log("11. Post Response Raw:", postData);

    if (!postResponse.ok) {
      return NextResponse.json({ error: "Failed to create post" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("FINAL CATCH ERROR:", error);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}