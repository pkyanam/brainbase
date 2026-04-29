import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For personal use and early experiments.",
    features: [
      "1 brain",
      "1,000 pages",
      "1 API key",
      "Community support",
      "MCP + REST API",
    ],
    cta: "Get started",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For professionals building with AI agents.",
    features: [
      "Unlimited brains",
      "Unlimited pages",
      "10 API keys",
      "Priority support",
      "Custom domains",
      "Team sharing",
      "Advanced analytics",
    ],
    cta: "Start free trial",
    href: "/sign-up",
    highlight: true,
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
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <Nav />

      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Simple pricing</h1>
          <p className="text-bb-text-secondary max-w-lg mx-auto">
            One API call. Your agents remember everything. Start free, upgrade when you need scale.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? "border-bb-accent/40 bg-bb-accent-glow"
                  : "border-bb-border bg-bb-bg-secondary"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-bb-accent text-bb-bg-primary text-xs font-medium rounded-full">
                    Most popular
                  </span>
                </div>
              )}
              <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-bb-text-muted text-sm">{plan.period}</span>
              </div>
              <p className="text-sm text-bb-text-muted mb-6">{plan.description}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-bb-text-secondary">
                    <span className="text-bb-accent mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  plan.highlight
                    ? "bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary"
                    : "bg-bb-surface hover:bg-bb-surface-hover text-bb-text-secondary border border-bb-border"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center text-sm text-bb-text-muted">
          All plans include the MCP server, REST API, CLI, and SDK.
        </div>
      </div>

      <Footer />
    </div>
  );
}
