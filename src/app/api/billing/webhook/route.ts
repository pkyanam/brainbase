/**
 * POST /api/billing/webhook
 *
 * Stripe webhook endpoint. Handles:
 * - checkout.session.completed → provision brain (upgrade plan)
 * - customer.subscription.deleted → downgrade to free
 * - invoice.payment_failed → notify
 *
 * Secured by Stripe webhook signature verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: any;
  try {
    const body = await req.text();
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-03-31.basil" as any,
    });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[brainbase] Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const brainId = session.metadata?.brain_id;
        if (brainId) {
          await query(
            `UPDATE brains SET plan = 'pro', stripe_customer_id = $2, updated_at = NOW()
             WHERE id = $1`,
            [brainId, session.customer as string]
          );
          console.log(`[brainbase] Brain ${brainId} upgraded to pro`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        await query(
          `UPDATE brains SET plan = 'free', updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [customerId]
        );
        console.log(`[brainbase] Customer ${customerId} downgraded to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.warn(
          `[brainbase] Payment failed for customer ${invoice.customer}`,
          invoice.id
        );
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[brainbase] Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
