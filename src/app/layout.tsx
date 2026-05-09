import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import ConvexClientProvider from "@/components/ConvexClientProvider";

export const metadata: Metadata = {
  title: "Brainbase — Shared knowledge for AI agents",
  description: "A database your agents share. Every agent reads from and writes to the same knowledge graph.",
  icons: {
    icon: "/brainbaseLogo.png",
  },
  openGraph: {
    title: "Brainbase — Shared knowledge for AI agents",
    description: "A database your agents share. Every agent reads from and writes to the same knowledge graph.",
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
    <html lang="en" className="bg-bb-bg-primary" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bb-bg-primary text-bb-text-primary antialiased font-sans">
        <AuthProvider>
          <ConvexClientProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </ConvexClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
