import Image from "next/image";
import { GithubLogo, XLogo } from "@phosphor-icons/react/dist/ssr";

const footerLinks = {
  product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Demo", href: "/demo" },
    { label: "Docs", href: "/docs" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-bb-border bg-bb-bg-primary">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <Image
                src="/brainbaseLogo.png"
                alt=""
                width={24}
                height={24}
                className="rounded w-6 h-6"
              />
              <span className="text-base font-semibold tracking-tight text-bb-text-primary">
                brainbase
              </span>
            </a>
            <p className="text-sm text-bb-text-muted leading-relaxed max-w-xs">
              Shared knowledge infrastructure for AI agents. One brain, every agent.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://github.com/pkyanam/brainbase"
                className="text-bb-text-muted hover:text-bb-text-primary transition-colors"
                aria-label="GitHub"
              >
                <GithubLogo className="w-5 h-5" />
              </a>
              <a
                href="https://x.com/brainbase"
                className="text-bb-text-muted hover:text-bb-text-primary transition-colors"
                aria-label="X (Twitter)"
              >
                <XLogo className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-sm font-semibold text-bb-text-primary mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-bb-text-muted hover:text-bb-text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-sm font-semibold text-bb-text-primary mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-bb-text-muted hover:text-bb-text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="text-sm font-semibold text-bb-text-primary mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-bb-text-muted hover:text-bb-text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-bb-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-bb-text-muted">
            &copy; {new Date().getFullYear()} Brainbase. All rights reserved.
          </p>
          <p className="text-sm text-bb-text-muted">
            Built with care in San Francisco.
          </p>
        </div>
      </div>
    </footer>
  );
}
