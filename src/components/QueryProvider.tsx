"use client";

/**
 * QueryProvider
 * ─────────────────────────────────────────────────────────
 * Single Responsibility: owns the TanStack Query client config.
 *
 * Cache strategy:
 *  - staleTime  5 min  → background refetch only after 5 min
 *  - gcTime    30 min  → keep unused data in memory for 30 min
 *                        (user navigates back = instant paint)
 *  - retry      1      → one silent retry on transient errors
 * ─────────────────────────────────────────────────────────
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:  5 * 60 * 1000,  // 5 min
            gcTime:    30 * 60 * 1000,  // 30 min
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
