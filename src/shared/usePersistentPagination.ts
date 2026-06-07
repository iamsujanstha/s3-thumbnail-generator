"use client";

/**
 * usePersistentPagination
 * ─────────────────────────────────────────────────────────
 * Simple cursor-based pagination with useState.
 *
 * Keeps a stack of previous cursors so the user can go back.
 * State resets on page refresh — intentional, since presigned
 * URLs expire anyway and a fresh load is always correct.
 * ─────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";

export interface PaginationState {
  cursor: string | undefined;
  cursorStack: string[];
}

export interface PaginationActions {
  goNext: (nextCursor: string) => void;
  goPrev: () => void;
  reset: () => void;
}

export function usePersistentPagination(): PaginationState & PaginationActions {
  // cursor === undefined means "first page" (no cursor sent to the API)
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const goNext = useCallback((nextCursor: string) => {
    setCursorStack((stack) => [...stack, cursor ?? ""]);
    setCursor(nextCursor);
  }, [cursor]);

  const goPrev = useCallback(() => {
    setCursorStack((stack) => {
      const next = [...stack];
      const prev = next.pop();           // remove last entry
      setCursor(prev || undefined);      // "" means first page → undefined
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setCursor(undefined);
    setCursorStack([]);
  }, []);

  return { cursor, cursorStack, goNext, goPrev, reset };
}
