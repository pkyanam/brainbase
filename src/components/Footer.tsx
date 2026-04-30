export default function Footer() {
  return (
    <footer className="border-t border-bb-border bg-bb-bg-primary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-sm text-bb-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-bb-accent" />
          <span>Brainbase</span>
          <span className="text-bb-border-strong">/</span>
          <span>Built on GBrain</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <a href="https://github.com/pkyanam/brainbase" className="text-bb-text-muted hover:text-bb-text-primary transition-colors">GitHub</a>
          <a href="/docs" className="text-bb-text-muted hover:text-bb-text-primary transition-colors">Docs</a>
          <a href="/pricing" className="text-bb-text-muted hover:text-bb-text-primary transition-colors">Pricing</a>
          <a href="/terms" className="text-bb-text-muted hover:text-bb-text-primary transition-colors">Terms</a>
          <a href="/privacy" className="text-bb-text-muted hover:text-bb-text-primary transition-colors">Privacy</a>
        </nav>
      </div>
    </footer>
  );
}
