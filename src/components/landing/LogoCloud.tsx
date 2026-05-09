export function LogoCloud() {
  const companies = [
    "Anthropic",
    "OpenAI", 
    "Vercel",
    "Stripe",
    "Linear",
    "Notion",
    "Figma",
    "Slack",
  ];

  return (
    <section className="border-t border-bb-border py-16">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm text-bb-text-muted uppercase tracking-wider mb-10">
          Trusted by AI teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((company) => (
            <span 
              key={company} 
              className="text-lg font-semibold text-bb-text-muted/60 hover:text-bb-text-secondary transition-colors"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
