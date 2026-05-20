import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Twitter OAuth 2.0 with PKCE
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/autopost/twitter/callback`;
  
  // Generate code verifier and challenge (simplified - use proper crypto in production)
  const codeVerifier = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  
  // Store code verifier in a temporary storage (use Supabase or Redis in production)
  // For now, we'll pass it through state parameter (not ideal for production)
  const state = Buffer.from(JSON.stringify({ userId, codeVerifier })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state: state,
    code_challenge: codeVerifier.substring(0, 64),
    code_challenge_method: "plain",
  });

  return NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  );
}