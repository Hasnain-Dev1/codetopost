import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=oauth_failed`);
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId, codeVerifier } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/autopost/twitter/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("Twitter token error:", tokens);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=token_exchange_failed`);
    }

    // USE SERVICE ROLE KEY TO BYPASS RLS (Safe for backend OAuth callbacks)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=server_config`);
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Store tokens in Supabase
    const { error } = await supabaseAdmin
      .from("social_connections")
      .upsert({
        user_id: userId,
        platform: "twitter",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' }); // Tells Supabase exactly how to handle duplicates

    if (error) {
      console.error("Supabase upsert error:", error.message);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=db_error&details=${error.message}`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?connected=twitter`);
  } catch (error) {
    console.error("Twitter callback error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=unknown`);
  }
}