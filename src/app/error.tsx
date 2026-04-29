"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4">Something broke</h1>
          <p className="text-bb-text-secondary mb-8 max-w-md mx-auto">
            We hit an unexpected error. Try refreshing the page or going back home.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={reset}
              className="px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-6 py-3 border border-bb-border hover:border-bb-border-hover text-bb-text-secondary font-medium rounded-xl transition-colors"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
