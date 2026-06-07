"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfileListItemDto, UpdateProfileDto } from "@/shared/dtos";

type Props = {
  profile: ProfileListItemDto | null;
  onClose: () => void;
  /** Called with the updated full name so the parent can display a toast */
  onSaved: (fullName: string) => void;
};

type FormState = {
  fullName: string;
  jobTitle: string;
  company: string;
};

const MAX = 120;

function CharCount({ value }: { value: string }) {
  const remaining = MAX - value.length;
  return (
    <span
      className={`text-xs tabular-nums ${remaining < 10 ? "text-amber-600" : "text-slate-400"}`}
      aria-label={`${remaining} characters remaining`}
    >
      {remaining}
    </span>
  );
}

export function EditProfileModal({ profile, onClose, onSaved }: Props) {
  const isOpen = !!profile;
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    fullName: "",
    jobTitle: "",
    company: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Sync + autofocus */
  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName,
        jobTitle: profile.jobTitle,
        company: profile.company,
      });
      setError(null);
      // Focus first input after mount
      requestAnimationFrame(() => firstInputRef.current?.focus());
    }
  }, [profile]);

  /* Escape key */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isSaving, onClose]);

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;

    setError(null);
    setIsSaving(true);

    try {
      const body: UpdateProfileDto = {
        fullName: form.fullName.trim(),
        jobTitle: form.jobTitle.trim(),
        company: form.company.trim(),
      };

      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update profile.");
      }

      onSaved(body.fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  /* Dirty state check */
  const isDirty = profile
    ? form.fullName !== profile.fullName ||
      form.jobTitle !== profile.jobTitle ||
      form.company !== profile.company
    : false;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={!isSaving ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-large">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Edit profile
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              disabled={isSaving}
              aria-label="Close dialog"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="edit-fullName"
                  className="text-sm font-medium text-slate-700"
                >
                  Full name
                </label>
                <CharCount value={form.fullName} />
              </div>
              <Input
                id="edit-fullName"
                ref={firstInputRef}
                required
                minLength={2}
                maxLength={MAX}
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                disabled={isSaving}
                aria-required="true"
              />
            </div>

            {/* Job title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="edit-jobTitle"
                  className="text-sm font-medium text-slate-700"
                >
                  Job title
                </label>
                <CharCount value={form.jobTitle} />
              </div>
              <Input
                id="edit-jobTitle"
                required
                minLength={2}
                maxLength={MAX}
                value={form.jobTitle}
                onChange={(e) => updateField("jobTitle", e.target.value)}
                disabled={isSaving}
                aria-required="true"
              />
            </div>

            {/* Company */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="edit-company"
                  className="text-sm font-medium text-slate-700"
                >
                  Company
                </label>
                <CharCount value={form.company} />
              </div>
              <Input
                id="edit-company"
                required
                minLength={2}
                maxLength={MAX}
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                disabled={isSaving}
                aria-required="true"
              />
            </div>

            {/* Error */}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSaving || !isDirty}
                aria-disabled={!isDirty}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
