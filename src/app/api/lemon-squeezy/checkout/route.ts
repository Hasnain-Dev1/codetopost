import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID; // Put your variant ID in .env
    
    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: { custom: { user_id: userId } }
          },
          relationships: {
            variant: { data: { type: "variants", id: variantId } }
          }
        }
      })
    });

    const data = await response.json();
    return NextResponse.json({ url: data.data.attributes.url });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}