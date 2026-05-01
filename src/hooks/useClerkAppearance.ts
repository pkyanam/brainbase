"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface ClerkAppearance {
  variables: Record<string, string | number>;
  elements: Record<string, string>;
}

/**
 * Returns Clerk-compatible appearance config that respects the current theme.
 * Clerk components (SignIn, SignUp, UserButton) use hardcoded colors by default.
 * This hook reads our CSS variable theme and maps them to Clerk's appearance format.
 */
export function useClerkAppearance(): { appearance: ClerkAppearance } {
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  return useMemo(() => {
    if (isDark) {
      return {
        appearance: {
          variables: {
            colorBackground: "#121212",
            colorInputBackground: "#0a0a0a",
            colorInputText: "#ededed",
            colorText: "#ededed",
            colorTextSecondary: "#b4b4b4",
            colorTextOnPrimaryBackground: "#0a0a0a",
            colorPrimary: "#3ecf8e",
            colorDanger: "#ef4444",
            colorNeutral: "#2a2a2a",
            borderRadius: "8px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          },
          elements: {
            rootBox: "w-full",
            card: "bg-[#121212] border border-[#1f1f1f] rounded-xl shadow-none",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            socialButtonsBlockButton:
              "bg-[#161616] border border-[#1f1f1f] hover:bg-[#1e1e1e] text-[#ededed] rounded-md normal-case",
            socialButtonsProviderIcon: "",
            formButtonPrimary:
              "bg-[#3ecf8e] hover:bg-[#34b87a] text-[#0a0a0a] font-medium rounded-md normal-case shadow-none border-none",
            formFieldInput:
              "bg-[#0a0a0a] border-[#1f1f1f] rounded-md text-[#ededed] focus:border-[#3ecf8e] focus:ring-0",
            formFieldLabel: "text-[#b4b4b4]",
            footerActionLink: "text-[#3ecf8e] hover:text-[#4ee0a0]",
            footerActionText: "text-[#888888]",
            dividerLine: "bg-[#1f1f1f]",
            dividerText: "text-[#888888]",
            identityPreviewText: "text-[#ededed]",
            identityPreviewEditButton: "text-[#3ecf8e] hover:text-[#4ee0a0]",
            // UserButton dropdown
            userButtonBox: "",
            userButtonTrigger: "text-[#ededed]",
            userButtonPopoverCard:
              "bg-[#121212] border border-[#1f1f1f] rounded-xl shadow-lg",
            userButtonPopoverActionButton:
              "text-[#ededed] hover:bg-[#161616]",
            userButtonPopoverActionButtonText: "text-[#ededed]",
            userButtonPopoverActionButtonIcon: "text-[#888888]",
            userButtonPopoverFooter: "border-t border-[#1f1f1f]",
          },
        },
      };
    }

    // Light mode
    return {
      appearance: {
        variables: {
          colorBackground: "#ffffff",
          colorInputBackground: "#f6f8fa",
          colorInputText: "#0a0a0a",
          colorText: "#0a0a0a",
          colorTextSecondary: "#57606a",
          colorTextOnPrimaryBackground: "#ffffff",
          colorPrimary: "#16a34a",
          colorDanger: "#dc2626",
          colorNeutral: "#e5e5e5",
          borderRadius: "8px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        },
        elements: {
          rootBox: "w-full",
          card: "bg-[#ffffff] border border-[#d1d5db] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          headerTitle: "hidden",
          headerSubtitle: "hidden",
          socialButtonsBlockButton:
            "bg-[#f6f8fa] border border-[#d1d5db] hover:bg-[#eaecf0] text-[#0a0a0a] rounded-md normal-case",
          socialButtonsProviderIcon: "",
          formButtonPrimary:
            "bg-[#16a34a] hover:bg-[#15803d] text-white font-medium rounded-md normal-case shadow-none border-none",
          formFieldInput:
            "bg-[#f6f8fa] border-[#d1d5db] rounded-md text-[#0a0a0a] focus:border-[#16a34a] focus:ring-0",
          formFieldLabel: "text-[#57606a]",
          footerActionLink: "text-[#16a34a] hover:text-[#15803d]",
          footerActionText: "text-[#6b7280]",
          dividerLine: "bg-[#d1d5db]",
          dividerText: "text-[#6b7280]",
          identityPreviewText: "text-[#0a0a0a]",
          identityPreviewEditButton: "text-[#16a34a] hover:text-[#15803d]",
          // UserButton dropdown
          userButtonBox: "",
          userButtonTrigger: "text-[#0a0a0a]",
          userButtonPopoverCard:
            "bg-[#ffffff] border border-[#d1d5db] rounded-xl shadow-lg",
          userButtonPopoverActionButton:
            "text-[#0a0a0a] hover:bg-[#f6f8fa]",
          userButtonPopoverActionButtonText: "text-[#0a0a0a]",
          userButtonPopoverActionButtonIcon: "text-[#57606a]",
          userButtonPopoverFooter: "border-t border-[#d1d5db]",
        },
      },
    };
  }, [isDark]);
}
