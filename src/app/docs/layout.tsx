import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { DocsLayoutClient } from "./DocsLayoutClient";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />
      <div className="flex-1 max-w-6xl mx-auto w-full px-5 md:px-6 py-10 md:py-14 flex flex-col">
        <DocsLayoutClient>{children}</DocsLayoutClient>
      </div>
      <Footer />
    </div>
  );
}
