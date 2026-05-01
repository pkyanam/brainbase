"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";

interface ClerkAppearance {
  variables: Record<string, string | number>;
  elements: Record<string, string>;
}

/**
 * Returns Clerk-compatible appearance config that respects the current theme.
 * Uses a "contrast card" approach: Clerk components get a distinct surface
 * that contrasts with the page background for readability.
 */
export function useClerkAppearance(): { appearance: ClerkAppearance } {
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  return useMemo(() => {
    if (isDark) {
      // Dark website: Clerk gets a slightly lighter card with light text
      return {
        appearance: {
          variables: {
            colorBackground: "#1c1c1c",
            colorInputBackground: "#0a0a0a",
            colorInputText: "#ffffff",
            colorText: "#e6e6e6",
            colorTextSecondary: "#9ca3af",
            colorTextOnPrimaryBackground: "#0a0a0a",
            colorPrimary: "#3ecf8e",
            colorDanger: "#ef4444",
            colorNeutral: "#333333",
            colorShimmer: "rgba(255,255,255,0.05)",
            borderRadius: "8px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          },
          elements: {
            rootBox: "w-full",
            card: "bg-[#1c1c1c] border border-[#333333] rounded-xl shadow-none",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            socialButtonsBlockButton:
              "bg-[#0a0a0a] border border-[#333333] hover:bg-[#1c1c1c] text-[#e6e6e6] font-medium rounded-md normal-case",
            socialButtonsBlockButtonText: "text-[#e6e6e6] font-medium",
            socialButtonsProviderIcon: "",
            formButtonPrimary:
              "bg-[#3ecf8e] hover:bg-[#34b87a] text-[#0a0a0a] font-medium rounded-md normal-case shadow-none border-none",
            formButtonReset:
              "bg-[#1c1c1c] border border-[#333333] hover:bg-[#262626] text-[#e6e6e6] rounded-md normal-case",
            formFieldInput:
              "bg-[#0a0a0a] border-[#333333] rounded-md text-white placeholder:text-[#6b7280] focus:border-[#3ecf8e] focus:ring-0",
            formFieldLabel: "text-[#9ca3af]",
            formFieldHintText: "text-[#6b7280]",
            formFieldErrorText: "text-[#ef4444]",
            formFieldSuccessText: "text-[#3ecf8e]",
            footerActionLink: "text-[#3ecf8e] hover:text-[#4ee0a0]",
            footerActionText: "text-[#9ca3af]",
            dividerLine: "bg-[#333333]",
            dividerText: "text-[#6b7280]",
            identityPreviewText: "text-[#e6e6e6]",
            identityPreviewEditButton: "text-[#3ecf8e] hover:text-[#4ee0a0]",
            alertText: "text-[#e6e6e6]",
            alert: "bg-[#1c1c1c] border border-[#333333] rounded-md",
            // UserButton dropdown
            userButtonBox: "",
            userButtonTrigger: "text-[#e6e6e6]",
            userButtonPopoverCard:
              "bg-[#1c1c1c] border border-[#333333] rounded-xl shadow-lg",
            userButtonPopoverActionButton:
              "text-[#e6e6e6] hover:bg-[#0a0a0a]",
            userButtonPopoverActionButtonText: "text-[#e6e6e6]",
            userButtonPopoverActionButtonIcon: "text-[#9ca3af]",
            userButtonPopoverFooter: "border-t border-[#333333]",
          },
        },
      };
    }

    // Light website: Clerk gets a white card with dark text
    return {
      appearance: {
        variables: {
          colorBackground: "#ffffff",
          colorInputBackground: "#f6f8fa",
          colorInputText: "#0a0a0a",
          colorText: "#1f2328",
          colorTextSecondary: "#57606a",
          colorTextOnPrimaryBackground: "#ffffff",
          colorPrimary: "#16a34a",
          colorDanger: "#dc2626",
          colorNeutral: "#e5e5e5",
          colorShimmer: "rgba(0,0,0,0.03)",
          borderRadius: "8px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        },
        elements: {
          rootBox: "w-full",
          card: "bg-white border border-[#d1d5db] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          headerTitle: "hidden",
          headerSubtitle: "hidden",
          socialButtonsBlockButton:
            "bg-[#f6f8fa] border border-[#d1d5db] hover:bg-[#eaecf0] text-[#1f2328] font-medium rounded-md normal-case",
          socialButtonsBlockButtonText: "text-[#1f2328] font-medium",
          socialButtonsProviderIcon: "",
          formButtonPrimary:
            "bg-[#16a34a] hover:bg-[#15803d] text-white font-medium rounded-md normal-case shadow-none border-none",
          formButtonReset:
            "bg-white border border-[#d1d5db] hover:bg-[#f6f8fa] text-[#1f2328] rounded-md normal-case",
          formFieldInput:
            "bg-[#f6f8fa] border-[#d1d5db] rounded-md text-[#0a0a0a] placeholder:text-[#9ca3af] focus:border-[#16a34a] focus:ring-0",
          formFieldLabel: "text-[#57606a]",
          formFieldHintText: "text-[#9ca3af]",
          formFieldErrorText: "text-[#dc2626]",
          formFieldSuccessText: "text-[#16a34a]",
          footerActionLink: "text-[#16a34a] hover:text-[#15803d]",
          footerActionText: "text-[#57606a]",
          dividerLine: "bg-[#d1d5db]",
          dividerText: "text-[#9ca3af]",
          identityPreviewText: "text-[#1f2328]",
          identityPreviewEditButton: "text-[#16a34a] hover:text-[#15803d]",
          alertText: "text-[#1f2328]",
          alert: "bg-white border border-[#d1d5db] rounded-md",
          // UserButton dropdown
          userButtonBox: "",
          userButtonTrigger: "text-[#1f2328]",
          userButtonPopoverCard:
            "bg-white border border-[#d1d5db] rounded-xl shadow-lg",
          userButtonPopoverActionButton:
            "text-[#1f2328] hover:bg-[#f6f8fa]",
          userButtonPopoverActionButtonText: "text-[#1f2328]",
          userButtonPopoverActionButtonIcon: "text-[#57606a]",
          userButtonPopoverFooter: "border-t border-[#d1d5db]",
        },
      },
    };
  }, [isDark]);
}
