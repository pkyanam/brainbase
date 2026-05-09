"use client";

import { 
  MagnifyingGlass, 
  Graph, 
  Lightning, 
  Lock, 
  Sparkle,
  Database
} from "@phosphor-icons/react";

const features = [
  {
    icon: MagnifyingGlass,
    title: "7-stage hybrid search",
    description: "Full-text search, vector embeddings, and graph traversal combined with RRF fusion for unmatched recall.",
  },
  {
    icon: Graph,
    title: "Neo4j graph intelligence",
    description: "PageRank, community detection, shortest paths, and similarity scoring built on enterprise-grade GDS.",
  },
  {
    icon: Lightning,
    title: "Real-time sync",
    description: "Changes propagate instantly. No stale embeddings. No waiting for batch jobs to complete.",
  },
  {
    icon: Lock,
    title: "Tenant isolation",
    description: "Row-level security ensures each brain is completely isolated. Your data never touches another tenant.",
  },
  {
    icon: Sparkle,
    title: "Dream mode",
    description: "Autonomous linking and enrichment while you sleep. Wake up to a smarter, more connected graph.",
  },
  {
    icon: Database,
    title: "Version history",
    description: "Every page edit is versioned. Roll back changes, audit modifications, track evolution over time.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-bb-accent uppercase tracking-wider">
            Capabilities
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Everything you need to ship
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-xl bg-bb-bg-secondary border border-bb-border hover:border-bb-border-hover transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-bb-accent/10 flex items-center justify-center mb-4 group-hover:bg-bb-accent/20 transition-colors">
                  <Icon className="w-5 h-5 text-bb-accent" />
                </div>
                <h3 className="font-semibold text-bb-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-bb-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
