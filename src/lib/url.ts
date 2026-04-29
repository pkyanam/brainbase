/**
 * Get the application's base URL.
 * - Server (API routes): derives from the request URL so it works on any domain,
 *   preview deployments, localhost, etc.
 * - Client: uses NEXT_PUBLIC_APP_URL env var, falling back to the production domain.
 */
export function getBaseUrl(req?: Request): string {
  if (req) {
    const { protocol, host } = new URL(req.url);
    return `${protocol}//${host}`;
  }
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "https://brainbase.belweave.ai";
}
