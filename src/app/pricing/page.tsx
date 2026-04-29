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
    <div className="min-h-screen bg-black text-neutral-100">
      <Nav />

      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Simple pricing</h1>
          <p className="text-neutral-400 max-w-lg mx-auto">
            One API call. Your agents remember everything. Start free, upgrade when you need scale.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? "border-violet-500/50 bg-violet-950/10"
                  : "border-neutral-900 bg-neutral-950"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded-full">
                    Most popular
                  </span>
                </div>
              )}
              <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-neutral-500 text-sm">{plan.period}</span>
              </div>
              <p className="text-sm text-neutral-500 mb-6">{plan.description}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-300">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  plan.highlight
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center text-sm text-neutral-600">
          All plans include the MCP server, REST API, CLI, and SDK.
        </div>
      </div>

      <Footer />
    </div>
  );
}
