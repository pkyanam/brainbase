/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for the Pro plan ($29/month).
 * Requires authenticated user. Returns the checkout URL for redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  // Dynamic import to avoid build-time stripe init
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-03-31.basil" as any,
  });

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price ID not configured" },
      { status: 500 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.nextUrl.origin}/dashboard?checkout=success`,
      cancel_url: `${req.nextUrl.origin}/pricing?checkout=cancelled`,
      metadata: {
        brain_id: auth.brainId,
        user_id: auth.userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[brainbase] Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
