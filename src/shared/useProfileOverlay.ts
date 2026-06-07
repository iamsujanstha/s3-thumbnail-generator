"use client";

/**
 * useProfileOverlay
 * Owns all overlay/modal state for the profiles page:
 *   – which profile sheet is open (viewId)
 *   – which profile is being edited
 *   – which profile is pending deletion
 *   – the delete mutation
 *
 * Also exposes imperative open* methods that are written into a
 * mutable ref so callers can hold a stable reference forever.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProfileListItemDto } from "@/shared/dtos";

export interface OverlayHandlers {
  openView:   (id: string) => void;
  openEdit:   (profile: ProfileListItemDto) => void;
  openDelete: (profile: ProfileListItemDto) => void;
}

export function useProfileOverlay(
  profiles: ProfileListItemDto[],
  onToast: (msg: string, kind: "success" | "error") => void,
) {
  const queryClient = useQueryClient();

  const [viewId, setViewId]               = useState<string | null>(null);
  const [editProfile, setEditProfile]     = useState<ProfileListItemDto | null>(null);
  const [deleteProfile, setDeleteProfile] = useState<ProfileListItemDto | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setDeleteProfile(null);
      onToast("Profile deleted successfully.", "success");
    },
    onError: () => {
      onToast("Could not delete. Please try again.", "error");
    },
  });

  const handlers: OverlayHandlers = {
    openView:   (id) => setViewId(id),
    openEdit:   (p)  => setEditProfile(p),
    openDelete: (p)  => setDeleteProfile(p),
  };

  return {
    /* State */
    viewId,
    editProfile,
    deleteProfile,
    isDeleting: deleteMutation.isPending,

    /* Actions */
    handlers,
    closeView:   () => setViewId(null),
    closeEdit:   () => setEditProfile(null),
    closeDelete: () => setDeleteProfile(null),

    onEditSaved: (name: string) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditProfile(null);
      onToast(`${name} updated successfully.`, "success");
    },

    onEditFromView: (id: string) => {
      const p = profiles.find((x) => x.id === id);
      if (p) { setViewId(null); setEditProfile(p); }
    },

    confirmDelete: () => {
      if (deleteProfile) deleteMutation.mutate(deleteProfile.id);
    },
  };
}
