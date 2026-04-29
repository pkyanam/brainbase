import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-sm text-neutral-400 leading-relaxed">
          <p>Last updated: April 29, 2026</p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">What We Collect</h2>
          <p>
            We collect your email address (via Clerk authentication), API usage metrics, and the content you choose
            to store in your brain. We do not collect payment information directly — that is handled by Stripe.
          </p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">How We Use It</h2>
          <p>
            Your data is used to provide the Brainbase service: storing your knowledge graph, serving API requests,
            and generating analytics. We do not sell your data to third parties.
          </p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">Data Deletion</h2>
          <p>
            You can delete your account and all associated data at any time from your settings page.
            Data is permanently removed from our databases within 30 days.
          </p>
          <h2 className="text-lg font-semibold text-neutral-200 mt-8">Contact</h2>
          <p>
            Questions? Email us at <a href="mailto:hello@brainbase.belweave.ai" className="text-violet-400 hover:underline">hello@brainbase.belweave.ai</a>.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
