import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const sections = [
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk", label: "SDK Usage" },
  { id: "mcp", label: "MCP Server" },
  { id: "cli", label: "CLI" },
  { id: "api", label: "API Reference" },
  { id: "architecture", label: "Architecture" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <div className="max-w-6xl mx-auto px-6 py-12 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="sticky top-8">
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
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
