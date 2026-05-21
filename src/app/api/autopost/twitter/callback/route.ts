import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return new Response("OAuth failed: Missing code or state", { status: 400 });
  }

  try {
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId, codeVerifier } = stateData;

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
      return new Response(`Twitter error: ${tokens.error}`, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabaseAdmin
      .from("social_connections")
      .upsert({
        user_id: userId,
        platform: "twitter",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });

    // RETURN HTML THAT CLOSES THE POPUP AND TELLS THE PARENT WINDOW WE ARE DONE!
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            window.opener.postMessage('TWITTER_CONNECTED', '*');
            window.close();
          </script>
          <p style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            Connected successfully! You can close this tab.
          </p>
        </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });

  } catch (error) {
    return new Response("Unknown error occurred", { status: 500 });
  }
}