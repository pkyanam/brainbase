import EvalDashboardClient from "./EvalDashboardClient";

// Eval dashboard is auth-gated and uses Clerk client hooks. Skip static prerender.
export const dynamic = "force-dynamic";

export default function Page() {
  return <EvalDashboardClient />;
}
