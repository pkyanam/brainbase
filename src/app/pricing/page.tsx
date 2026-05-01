"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Suspense } from "react";
import dynamic from "next/dynamic";

const CheckoutButton = dynamic(
  () => import("@/components/CheckoutButton").then((m) => ({ default: m.CheckoutButton })),
  { ssr: false }
);

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For personal use and early experiments.",
    features: [
      "1 brain",
      "100 pages / month",
      "500 searches / month",
      "1 API key",
      "Community support",
      "MCP + REST API",
    ],
    cta: "Get started",
    href: "/sign-up",
    primary: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For professionals building with AI agents.",
    features: [
      "Up to 10 brains",
      "5,000 pages / month",
      "20,000 searches / month",
      "10 API keys",
      "Priority support",
      "Custom domains",
      "Team sharing",
    ],
    cta: null, // rendered via CheckoutButton
    href: null,
    primary: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams that need scale and security.",
    features: [
      "Everything in Pro",
      "SSO / SAML",
      "Dedicated infra",
      "SLA guarantee",
      "Custom integrations",
      "Dedicated support",
    ],
    cta: "Contact us",
    href: "mailto:hello@brainbase.belweave.ai",
    primary: false,
  },
];

function PricingContent() {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-5 md:px-6 py-16 md:py-24">
          <div className="text-center mb-14 md:mb-16">
            <p className="text-xs uppercase tracking-widest text-bb-accent font-medium mb-3">
              Pricing
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Simple, predictable pricing
            </h1>
            <p className="text-bb-text-secondary max-w-lg mx-auto text-sm md:text-base">
              One API call. Your agents remember everything. Start free, upgrade
              when you need scale.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-6 flex flex-col transition-colors ${
                  plan.primary
                    ? "border-bb-accent/50 bg-bb-bg-secondary"
                    : "border-bb-border bg-bb-bg-secondary hover:border-bb-border-strong"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-bb-text-primary uppercase tracking-wider">
                    {plan.name}
                  </h3>
                  {plan.primary && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-bb-accent border border-bb-accent/40 px-2 py-0.5 rounded-full bg-bb-accent-glow">
                      Pro
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-3 mt-2">
                  <span className="text-3xl md:text-4xl font-semibold tracking-tight text-bb-text-primary">
                    {plan.price}
                  </span>
                  <span className="text-bb-text-muted text-sm">
                    {plan.period}
                  </span>
                </div>
                <p className="text-sm text-bb-text-muted mb-6 min-h-[2.5rem]">
                  {plan.description}
                </p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-bb-text-secondary"
                    >
                      <svg
                        className="w-4 h-4 text-bb-accent mt-0.5 shrink-0"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 10l3 3 7-7"
                        />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {plan.primary ? (
                  <CheckoutButton />
                ) : (
                  <a
                    href={plan.href!}
                    className="block text-center h-11 leading-[2.75rem] rounded-md text-sm font-medium transition-colors bg-bb-surface hover:bg-bb-surface-hover text-bb-text-primary border border-bb-border"
                  >
                    {plan.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-14 md:mt-16 text-center text-xs md:text-sm text-bb-text-muted">
            All plans include the MCP server, REST API, CLI, and SDK.
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function Pricing() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bb-bg-primary flex items-center justify-center">
          <div className="animate-pulse text-bb-text-muted">Loading…</div>
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
