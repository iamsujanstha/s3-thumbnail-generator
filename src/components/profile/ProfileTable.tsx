"use client";

/**
 * ProfileTable — public entry point
 *
 * Responsibilities (each in its own module):
 *   Data fetching + pagination  → this file (ProfileTableInner)
 *   Context definition          → ProfileTableContext.ts
 *   Table UI + search           → ProfileGridView.tsx
 *   Row / avatar / skeleton     → ProfileTableRows.tsx
 *   Overlay state + delete      → useProfileOverlay.ts (shared hook)
 *   Modals / sheet              → ProfileDetailSheet, EditProfileModal,
 *                                  ConfirmDeleteDialog
 */

import { Suspense, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { ProfileDetailSheet }  from "@/components/profile/ProfileDetailSheet";
import { EditProfileModal }    from "@/components/profile/EditProfileModal";
import { ConfirmDeleteDialog } from "@/components/profile/ConfirmDeleteDialog";
import { ProfileGridView }     from "@/components/profile/ProfileGridView";
import {
  OverlayActionsContext,
  type OverlayActions,
} from "@/components/profile/ProfileTableContext";
import { useProfileOverlay }   from "@/shared/useProfileOverlay";
import { usePersistentPagination } from "@/shared/usePersistentPagination";
import type { ProfileListItemDto } from "@/shared/dtos";

/* ─── API ────────────────────────────────────────────────────── */
type ApiResponse = { profiles: ProfileListItemDto[]; nextCursor: string | null };

async function fetchProfiles(cursor?: string): Promise<ApiResponse> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/profiles?${params}`);
  if (!res.ok) throw new Error("Failed to load profiles");
  return res.json();
}

/* ─── Inner (needs Suspense for useSearchParams) ─────────────── */
function ProfileTableInner() {
  const queryClient = useQueryClient();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToast();
  const { cursor, cursorStack, goNext, goPrev } = usePersistentPagination();

  /* Data */
  const { data, isFetching, isError } = useQuery({
    queryKey: ["profiles", cursor],
    queryFn:  () => fetchProfiles(cursor),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  /* Prefetch next page as soon as current data arrives */
  const prefetchNext = useCallback(
    (next: string) =>
      queryClient.prefetchQuery({
        queryKey: ["profiles", next],
        queryFn:  () => fetchProfiles(next),
        staleTime: 5 * 60 * 1000,
      }),
    [queryClient]
  );
  if (data?.nextCursor) prefetchNext(data.nextCursor);

  const profiles = data?.profiles ?? [];

  /* Overlay state (view / edit / delete) lives in its own hook */
  const overlay = useProfileOverlay(profiles, pushToast);

  /*
   * Stable overlay actions for the context.
   * We write the real setters into a mutable ref so the useMemo
   * value below is created once and never changes reference —
   * preventing any table row from re-rendering when a modal opens.
   */
  const overlayRef = useRef(overlay.handlers);
  overlayRef.current = overlay.handlers;

  const overlayActions = useMemo<OverlayActions>(
    () => ({
      openView:   (id) => overlayRef.current.openView(id),
      openEdit:   (p)  => overlayRef.current.openEdit(p),
      openDelete: (p)  => overlayRef.current.openDelete(p),
    }),
    [] // intentionally empty — stable forever
  );

  return (
    <OverlayActionsContext.Provider value={overlayActions}>
      {/* Pure table — never re-renders on modal state changes */}
      <ProfileGridView
        profiles={profiles}
        isFetching={isFetching}
        isError={isError}
        hasPrev={cursorStack.length > 0}
        hasNext={!!data?.nextCursor}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ["profiles"] })}
        onPrev={goPrev}
        onNext={() => data?.nextCursor && goNext(data.nextCursor)}
      />

      {/* Modals — state changes isolated from table */}
      <ProfileDetailSheet
        profileId={overlay.viewId}
        onClose={overlay.closeView}
        onEdit={overlay.onEditFromView}
      />
      <EditProfileModal
        profile={overlay.editProfile}
        onClose={overlay.closeEdit}
        onSaved={overlay.onEditSaved}
      />
      <ConfirmDeleteDialog
        profile={overlay.deleteProfile}
        isDeleting={overlay.isDeleting}
        onCancel={overlay.closeDelete}
        onConfirm={overlay.confirmDelete}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </OverlayActionsContext.Provider>
  );
}

/* ─── Public export ──────────────────────────────────────────── */
export function ProfileTable() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <ProfileTableInner />
    </Suspense>
  );
}
