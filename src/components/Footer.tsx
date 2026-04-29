export default function Footer() {
  return (
    <footer className="border-t border-neutral-900 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
        <span>Brainbase · Built on GStack</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/pkyanam/brainbase" className="hover:text-neutral-400 transition-colors">GitHub</a>
          <a href="/docs" className="hover:text-neutral-400 transition-colors">Docs</a>
          <a href="/pricing" className="hover:text-neutral-400 transition-colors">Pricing</a>
          <a href="/terms" className="hover:text-neutral-400 transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
