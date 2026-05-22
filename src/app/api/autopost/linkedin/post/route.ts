import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { caption, userId, imageBase64 } = await request.json();

    // 1. Get tokens from DB
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

    // 2. Refresh token if expired
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

    // 3. THE 3-STEP LINKEDIN IMAGE UPLOAD (Based on your research)
    if (imageBase64) {
      try {
        // Remove data URL prefix and convert to Buffer
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        // STEP 1: Register the upload with the EXACT recipe LinkedIn wants
        const registerRes = await fetch("https://api.linkedin.com/v2/assets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...linkedinHeaders,
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: `urn:li:person:${connection.platform_user_id}`,
              supportedUploadMechanisms: ["SYNCHRONOUS_UPLOAD"], // THE MISSING PIECE!
              serviceRelationships: [
                {
                  relationshipType: "OWNER",
                  identifier: "urn:li:userGeneratedContent",
                },
              ],
            },
          }),
        });

        const registerData = await registerRes.json();

        if (registerData.value) {
          const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
          mediaAssetId = registerData.value.asset;

          // STEP 2: Upload the binary file (Explicitly set image/png)
          await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "image/png", // EXPLICIT TYPE FIX
              "Authorization": `Bearer ${accessToken}`,
            },
            body: imageBuffer,
          });
        } else {
          console.error("LinkedIn Register Failed:", JSON.stringify(registerData));
          return NextResponse.json({ error: "Failed to register image with LinkedIn." }, { status: 500 });
        }
      } catch (imgErr: any) {
        console.error("LinkedIn Image Upload Error:", imgErr.message);
        return NextResponse.json({ 
          error: `Image upload failed: ${imgErr.message}. Try a shorter code snippet.` 
        }, { status: 500 });
      }
    }

    // ⏳ CRITICAL FIX: Wait for LinkedIn to process the image
    if (mediaAssetId) {
      console.log("Waiting 3 seconds for LinkedIn to process the image asset...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 3: Create the Post (With proper description and title)
    const postBody: any = {
      author: `urn:li:person:${connection.platform_user_id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: caption,
          },
          shareMediaCategory: mediaAssetId ? "IMAGE" : "NONE",
          ...(mediaAssetId && {
            media: [
              {
                status: "READY",
                description: {
                  text: "Code snippet generated by CodeToPost",
                },
                media: mediaAssetId,
                title: {
                  text: "CodeToPost Image",
                },
              },
            ],
          }),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...linkedinHeaders,
      },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json();
      console.error("LinkedIn Post Failed:", JSON.stringify(errorData));
      return NextResponse.json({ error: errorData.message || "Failed to create post" }, { status: postResponse.status });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("LinkedIn post error:", error);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}