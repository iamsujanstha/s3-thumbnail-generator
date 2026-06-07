/**
 * ProfileTableContext
 * Defines the context that lets table rows trigger overlay actions
 * (view / edit / delete) without holding that state themselves.
 *
 * Kept in its own file so it can be imported by both
 * ProfileGridView and ProfileTable without circular deps.
 */
import { createContext, useContext } from "react";
import type { ProfileListItemDto } from "@/shared/dtos";

export type OverlayActions = {
  openView:   (id: string) => void;
  openEdit:   (profile: ProfileListItemDto) => void;
  openDelete: (profile: ProfileListItemDto) => void;
};

export const OverlayActionsContext = createContext<OverlayActions>({
  openView:   () => {},
  openEdit:   () => {},
  openDelete: () => {},
});

export function useOverlayActions(): OverlayActions {
  return useContext(OverlayActionsContext);
}
