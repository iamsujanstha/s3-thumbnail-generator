"use client";

/**
 * usePersistentPagination
 * ─────────────────────────────────────────────────────────
 * Encapsulates cursor-based pagination state and persists the
 * current cursor in the URL search params so the user can
 * bookmark/share/refresh and land on the same page.
 *
 * Design:
 *  - Single Responsibility: owns only pagination concerns
 *  - Open/Closed: callers pass their own router/search hooks,
 *    keeping this hook decoupled from Next.js internals
 * ─────────────────────────────────────────────────────────
 */

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface PaginationState {
  /** Current cursor sent to the API (undefined = first page) */
  cursor: string | undefined;
  /** Stack of previous cursors for going back */
  cursorStack: string[];
}

export interface PaginationActions {
  goNext: (nextCursor: string) => void;
  goPrev: () => void;
  reset: () => void;
}

export function usePersistentPagination(): PaginationState & PaginationActions {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Cursor is stored in ?cursor=xxx
  const cursor = searchParams.get("cursor") ?? undefined;

  // The back-stack is stored as ?stack=a,b,c (comma-joined)
  const cursorStack: string[] = useMemo(() => {
    const raw = searchParams.get("stack");
    if (!raw) return [];
    return raw.split(",").filter(Boolean);
  }, [searchParams]);

  /** Build a new URL with updated params — preserves all other params */
  const buildUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const goNext = useCallback(
    (nextCursor: string) => {
      const newStack = [...cursorStack, cursor ?? ""].join(",");
      router.push(
        buildUrl({
          cursor: nextCursor,
          stack: newStack || null,
        })
      );
    },
    [router, buildUrl, cursor, cursorStack]
  );

  const goPrev = useCallback(() => {
    const stack = [...cursorStack];
    const prev = stack.pop() ?? "";
    router.push(
      buildUrl({
        cursor: prev || null,
        stack: stack.join(",") || null,
      })
    );
  }, [router, buildUrl, cursorStack]);

  const reset = useCallback(() => {
    router.push(buildUrl({ cursor: null, stack: null }));
  }, [router, buildUrl]);

  return { cursor, cursorStack, goNext, goPrev, reset };
}
