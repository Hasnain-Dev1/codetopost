import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=oauth_failed`);
  }

  try {
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId } = stateData;

    // Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/autopost/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("LinkedIn token error:", tokens);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=token_exchange_failed`);
    }

    // Get LinkedIn user ID (person urn)
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const profileData = await profileResponse.json();
    const linkedinUserId = profileData.sub;

    // Store in Supabase
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_connections")
      .upsert({
        user_id: userId,
        platform: "linkedin",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        platform_user_id: linkedinUserId,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=db_error`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?connected=linkedin`);
  } catch (error) {
    console.error("LinkedIn callback error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=unknown`);
  }
}