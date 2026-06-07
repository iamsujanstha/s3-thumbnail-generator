"use client";

import { useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { ProfileDetailSheet } from "@/components/profile/ProfileDetailSheet";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { ConfirmDeleteDialog } from "@/components/profile/ConfirmDeleteDialog";
import { ProfileGridView } from "@/components/profile/ProfileGridView";
import {
  OverlayActionsContext,
  type OverlayActions,
} from "@/components/profile/ProfileTableContext";
import { useProfileOverlay } from "@/shared/useProfileOverlay";
import { usePersistentPagination } from "@/shared/usePersistentPagination";
import type { ProfileListItemDto } from "@/shared/dtos";

/* ─── API ────────────────────────────────────────────────────── */
type ApiResponse = { profiles: ProfileListItemDto[]; nextCursor: string | null };

async function fetchProfiles(cursor?: string): Promise<ApiResponse> {
  const params = new URLSearchParams({ limit: "10" });
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

  /* Data — staleTime: 0 on page 1 so navigating back always shows
     the latest profiles (including any just created on the home page).
     Subsequent pages keep a 5-min cache since they're less likely to change. */
  const { data, isFetching, isError } = useQuery({
    queryKey: ["profiles", cursor],
    queryFn:  () => fetchProfiles(cursor),
    placeholderData: (prev) => prev,
    staleTime: cursor ? 5 * 60 * 1000 : 0,
  });

  const profiles = data?.profiles ?? [];

  /* Overlay state (view / edit / delete) lives in its own hook */
  const overlay = useProfileOverlay(profiles, pushToast);

  const overlayRef = useRef(overlay.handlers);
  overlayRef.current = overlay.handlers;

  const overlayActions = useMemo<OverlayActions>(
    () => ({
      openView: (id) => overlayRef.current.openView(id),
      openEdit: (p) => overlayRef.current.openEdit(p),
      openDelete: (p) => overlayRef.current.openDelete(p),
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
  return <ProfileTableInner />;
}
