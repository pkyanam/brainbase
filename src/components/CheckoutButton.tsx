"use client";

import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export function CheckoutButton() {
  const { isSignedIn, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start checkout");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }, []);

  // Auto-trigger checkout when returning from sign-in with ?checkout=pro
  useEffect(() => {
    if (isLoaded && isSignedIn && searchParams.get("checkout") === "pro") {
      triggerCheckout();
    }
  }, [isLoaded, isSignedIn, searchParams, triggerCheckout]);

  const handleClick = () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/pricing?checkout=pro")}`;
      return;
    }

    triggerCheckout();
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || !isLoaded}
        className="block w-full text-center h-11 leading-[2.75rem] rounded-md text-sm font-medium transition-colors bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading
          ? "Redirecting to Stripe..."
          : isLoaded && !isSignedIn
            ? "Sign in to upgrade"
            : "Upgrade to Pro"}
      </button>
      {error && (
        <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
