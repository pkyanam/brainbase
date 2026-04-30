import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const sections = [
  { id: "agent-onboarding", label: "Agent onboarding" },
  { id: "quickstart", label: "Quickstart" },
  { id: "mcp-setup", label: "MCP setup" },
  { id: "sdk", label: "SDK usage" },
  { id: "cli", label: "CLI" },
  { id: "api", label: "API reference" },
  { id: "architecture", label: "Architecture" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />
      <div className="flex-1 max-w-6xl mx-auto w-full px-5 md:px-6 py-10 md:py-14 flex gap-10 lg:gap-14">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24">
            <p className="text-[11px] font-medium text-bb-text-muted uppercase tracking-widest mb-3 px-3">
              On this page
            </p>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block px-3 py-1.5 text-sm text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface rounded-md transition-colors"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      <Footer />
    </div>
  );
}
