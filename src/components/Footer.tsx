export default function Footer() {
  return (
    <footer className="border-t border-bb-border py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-bb-text-muted">
        <span>Brainbase · Built on GBrain</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/pkyanam/brainbase" className="hover:text-bb-text-secondary transition-colors">GitHub</a>
          <a href="/docs" className="hover:text-bb-text-secondary transition-colors">Docs</a>
          <a href="/pricing" className="hover:text-bb-text-secondary transition-colors">Pricing</a>
          <a href="/terms" className="hover:text-bb-text-secondary transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-bb-text-secondary transition-colors">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
