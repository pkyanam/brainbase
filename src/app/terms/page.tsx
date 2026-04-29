import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <div className="space-y-6 text-sm text-neutral-400 leading-relaxed">
          <p>Last updated: April 29, 2026</p>
          <p>
            By using Brainbase, you agree to these terms. Brainbase is a knowledge graph API service for AI agents.
            We provide the infrastructure; you own your data.
          </p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">Usage</h2>
          <p>
            You may not use Brainbase to store or process illegal content, spam, or material that violates third-party rights.
            We reserve the right to suspend accounts that abuse the service.
          </p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">Data Ownership</h2>
          <p>
            You retain full ownership of the data you store in your brain. We do not train AI models on your data
            without explicit consent.
          </p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">Limitation of Liability</h2>
          <p>
            Brainbase is provided as-is. We are not liable for damages arising from service interruptions,
            data loss, or API errors. Use at your own risk.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
