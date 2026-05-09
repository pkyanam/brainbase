"use client";

import { ArrowRight } from "@phosphor-icons/react";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full animate-glow-pulse"
          style={{
            background: "radial-gradient(circle, rgba(124, 92, 255, 0.25) 0%, transparent 70%)",
            transform: "translate(30%, -30%)",
          }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full animate-glow-pulse"
          style={{
            background: "radial-gradient(circle, rgba(124, 92, 255, 0.1) 0%, transparent 70%)",
            transform: "translate(-40%, 40%)",
            animationDelay: "1.5s",
          }}
        />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="max-w-4xl">
          {/* Eyebrow */}
          <div>
            <span className="inline-block text-sm font-medium text-bb-accent tracking-wide uppercase mb-6">
              Shared knowledge for AI agents
            </span>
          </div>

          {/* Main headline */}
          <h1>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-balance">
              Ship AI products
            </span>
            <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-balance mt-2">
              that work.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mt-8 text-lg md:text-xl text-bb-text-secondary max-w-2xl leading-relaxed">
            Brainbase is the end-to-end platform for building AI agents that share knowledge. 
            One API call. Every agent in your stack reads from the same brain.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start gap-4 mt-10">
            <a
              href="/sign-up"
              className="group inline-flex items-center justify-center h-12 px-6 bg-bb-text-primary text-bb-bg-primary font-medium rounded-lg transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Get started
            </a>
            <a
              href="/demo"
              className="group inline-flex items-center justify-center h-12 px-6 text-bb-text-primary font-medium rounded-lg border border-bb-border hover:border-bb-border-hover hover:bg-bb-surface transition-all"
            >
              <span>View demo</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
