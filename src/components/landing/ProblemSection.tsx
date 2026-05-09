export function ProblemSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left - sticky text */}
          <div className="lg:sticky lg:top-32">
            <span className="text-sm font-medium text-bb-accent uppercase tracking-wider">
              The problem
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-balance">
              Every AI agent starts from zero.
            </h2>
            <p className="mt-6 text-lg text-bb-text-secondary leading-relaxed max-w-lg">
              You run five agents. Claude Code builds features. Cursor edits frontend. 
              None of them know what the others built, decided, or learned.
            </p>
          </div>

          {/* Right - problem cards */}
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-bb-bg-secondary border border-bb-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-bb-danger/10 flex items-center justify-center shrink-0">
                  <span className="text-bb-danger font-mono text-lg">01</span>
                </div>
                <div>
                  <h3 className="font-semibold text-bb-text-primary mb-2">
                    Isolated context
                  </h3>
                  <p className="text-bb-text-secondary text-sm leading-relaxed">
                    Each agent operates in a silo. No shared memory. No awareness of decisions 
                    made by other agents. You become the manual sync layer.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-bb-bg-secondary border border-bb-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-bb-warning/10 flex items-center justify-center shrink-0">
                  <span className="text-bb-warning font-mono text-lg">02</span>
                </div>
                <div>
                  <h3 className="font-semibold text-bb-text-primary mb-2">
                    Dumb vector search
                  </h3>
                  <p className="text-bb-text-secondary text-sm leading-relaxed">
                    Dumping embeddings into a vector store gives you retrieval, not understanding. 
                    No typed relationships. Nothing agents can reason over.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-bb-surface border border-bb-accent/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-bb-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-bb-accent font-mono text-lg">03</span>
                </div>
                <div>
                  <h3 className="font-semibold text-bb-accent mb-2">
                    Brainbase
                  </h3>
                  <p className="text-bb-text-secondary text-sm leading-relaxed">
                    Every agent reads from and writes to the same knowledge graph. Typed links 
                    connect entities. Graph intelligence surfaces what matters. No manual sync.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
