import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-neutral-800 mb-4">404</h1>
          <p className="text-neutral-400 mb-8">This page doesn&apos;t exist in our brain.</p>
          <a href="/" className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors">
            Go home
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
