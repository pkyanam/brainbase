import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import ConvexClientProvider from "@/components/ConvexClientProvider";

export const metadata: Metadata = {
  title: "Brainbase — AI Agent Memory",
  description: "One API call. Your agents remember everything. Powered by GBrain.",
  icons: {
    icon: [
      { url: "/brainbaseLogo.png", type: "image/png", sizes: "1160x1127" },
    ],
    apple: [
      { url: "/brainbaseLogo.png", type: "image/png", sizes: "1160x1127" },
    ],
    shortcut: "/brainbaseLogo.png",
  },
  openGraph: {
    title: "Brainbase — Give your AI agents a memory",
    description: "Self-enriching knowledge graph API for AI agents. MCP-native. Postgres-backed.",
    images: [{ url: "/brainbaseLogo.png", width: 1160, height: 1127 }],
  },
};

const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('brainbase-theme') || 'system';
      var resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bb-bg-primary text-bb-text-primary antialiased">
        <AuthProvider>
          <ConvexClientProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
