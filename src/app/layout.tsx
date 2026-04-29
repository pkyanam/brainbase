import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Brainbase — AI Agent Memory",
  description: "One API call. Your agents remember everything. Powered by GStack.",
  icons: {
    icon: "/brainbaseLogo.png",
    apple: "/brainbaseLogo.png",
  },
  openGraph: {
    title: "Brainbase — Give your AI agents a memory",
    description: "Self-enriching knowledge graph API for AI agents. MCP-native. Postgres-backed.",
    images: [{ url: "/brainbaseLogo.png", width: 1160, height: 1127 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bb-bg-primary text-bb-text-primary antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
