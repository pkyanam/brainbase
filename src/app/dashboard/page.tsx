import DashboardClient from "./DashboardClient";

// Dashboard is auth-gated and uses Clerk client hooks. Skip static prerender so
// the build does not try to evaluate Clerk without env keys.
export const dynamic = "force-dynamic";

export default function Page() {
  return <DashboardClient />;
}
