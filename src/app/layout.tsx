import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Brainbase — AI Agent Memory",
  description: "One API call. Your agents remember everything. Powered by GStack.",
  openGraph: {
    title: "Brainbase — Give your AI agents a memory",
    description: "Self-enriching knowledge graph API for AI agents. MCP-native. Postgres-backed.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black text-neutral-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
