"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfileListItemDto } from "@/shared/dtos";

type Props = {
  profile: ProfileListItemDto | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  profile,
  isDeleting,
  onCancel,
  onConfirm,
}: Props) {
  const isOpen = !!profile;
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  /* Focus the Cancel button on open — safer default for destructive dialogs */
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [isOpen]);

  /* Escape to close */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={!isDeleting ? onCancel : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-sm animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-large">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Delete profile
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCancel}
              disabled={isDeleting}
              aria-label="Close dialog"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="px-5 py-6 space-y-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50"
              aria-hidden="true"
            >
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>

            <p id={descId} className="text-sm leading-relaxed text-slate-600">
              Are you sure you want to delete{" "}
              <strong className="font-semibold text-slate-900">
                {profile.fullName}
              </strong>
              ? This action{" "}
              <strong className="text-red-600">cannot be undone</strong>.
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Keep profile
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={onConfirm}
              disabled={isDeleting}
              aria-label={`Confirm delete ${profile.fullName}`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
