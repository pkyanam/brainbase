import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-bb-border mb-4">404</h1>
          <p className="text-bb-text-secondary mb-8">This page doesn&apos;t exist in our brain.</p>
          <a href="/" className="px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors">
            Go home
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
