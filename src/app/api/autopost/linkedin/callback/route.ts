import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // LOG EVERYTHING TO SEE WHAT LINKEDIN SENT
  console.log("=== LINKEDIN CALLBACK DEBUG ===");
  console.log("Full URL:", request.url);
  console.log("Code:", code);
  console.log("State:", state);
  console.log("Error:", error);
  console.log("=============================");

  if (!code || !state) {
    // If LinkedIn sent an error, tell us what it is
    if (error) {
      console.error("LinkedIn Error:", error, searchParams.get("error_description"));
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=linkedin_error_${error}`);
    }
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=oauth_failed`);
  }

  try {
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId } = stateData;

    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      console.error("LinkedIn Token Error:", tokens);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=token_failed`);
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const profileData = await profileResponse.json();
    const linkedinUserId = profileData.sub;

    await supabaseAdmin.from("social_connections").upsert({
      user_id: userId,
      platform: "linkedin",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      platform_user_id: linkedinUserId,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            window.opener.postMessage('LINKEDIN_CONNECTED', '*');
            window.close();
          </script>
          <p style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            Connected to LinkedIn successfully! You can close this tab.
          </p>
        </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });

  } catch (error) {
    console.error("LinkedIn callback error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app?error=unknown`);
  }
}