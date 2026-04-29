"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4">Something broke</h1>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            We hit an unexpected error. Try refreshing the page or going back home.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={reset}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-6 py-3 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-medium rounded-xl transition-colors"
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
