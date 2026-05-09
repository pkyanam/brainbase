"use client";

import { ArrowRight } from "@phosphor-icons/react";

export function CTASection() {
  return (
    <section className="py-24 md:py-32 border-t border-bb-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative rounded-2xl bg-bb-bg-secondary border border-bb-border overflow-hidden">
          {/* Background glow */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(124, 92, 255, 0.15) 0%, transparent 70%)",
            }}
          />
          
          <div className="relative px-8 py-16 md:py-24 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
              Start building today
            </h2>
            <p className="text-lg text-bb-text-secondary max-w-xl mx-auto mb-10">
              Free tier includes 1,000 pages and 10,000 API calls per month. 
              No credit card required.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/sign-up"
                className="inline-flex items-center justify-center h-12 px-8 bg-bb-text-primary text-bb-bg-primary font-medium rounded-lg transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Get started free
              </a>
              <a
                href="/docs"
                className="group inline-flex items-center justify-center h-12 px-6 text-bb-text-secondary hover:text-bb-text-primary font-medium transition-colors"
              >
                <span>Read the docs</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
