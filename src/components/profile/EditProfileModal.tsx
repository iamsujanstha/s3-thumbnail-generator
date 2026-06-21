"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProfileListItemDto, UpdateProfileDto } from "@/shared/dtos";
import { useS3Upload } from "@/shared/useS3Upload";
import { ImageDropZone } from "@/components/profile/ImageDropZone";
import { getOriginalFilename } from "@/shared/utils";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    fullName: "",
    jobTitle: "",
    company: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasClearedOriginalImage, setHasClearedOriginalImage] = useState(false);

  const {
    file,
    setFile,
    uploadedKey,
    setUploadedKey,
    step: s3Step,
    setStep: setS3Step,
    error: s3Error,
    uploadProgress,
    setUploadProgress,
    previewUrl,
    selectFile,
    clearFile,
  } = useS3Upload();

  /* Sync + autofocus */
  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName,
        jobTitle: profile.jobTitle,
        company: profile.company,
      });
      setError(null);
      setFile(null);
      setUploadedKey(null);
      setUploadProgress(null);
      setS3Step("idle");
      setHasClearedOriginalImage(false);
      // Focus first input after mount
      requestAnimationFrame(() => firstInputRef.current?.focus());
    }
  }, [profile, setFile, setUploadedKey, setUploadProgress, setS3Step]);

  /* Escape key */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const isUploading = s3Step === "uploading" || s3Step === "presigning" || s3Step === "saving";
      if (e.key === "Escape" && !isSaving && !isUploading) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isSaving, s3Step, onClose]);

  /* Revoke object URL on unmount / file change */
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleClear() {
    clearFile();
    setHasClearedOriginalImage(true);
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
        ...(uploadedKey ? { imageKey: uploadedKey } : hasClearedOriginalImage ? { imageKey: "" } : {}),
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

      // Reset file and key states so unmount effect doesn't trigger S3 delete
      setUploadedKey(null);
      setFile(null);
      onSaved(body.fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  const isUploading = s3Step === "uploading" || s3Step === "presigning" || s3Step === "saving";
  const combinedError = error || s3Error;

  /* Dirty state check */
  const isDirty = profile
    ? form.fullName !== profile.fullName ||
      form.jobTitle !== profile.jobTitle ||
      form.company !== profile.company ||
      !!uploadedKey ||
      (hasClearedOriginalImage && !!profile.imageKey)
    : false;

  const finalPreviewUrl = previewUrl || (hasClearedOriginalImage ? null : (profile ? profile.thumbnailUrl : null));

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={!isSaving && !isUploading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md animate-scale-in rounded-2xl border border-slate-200 bg-white shadow-large overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Edit profile
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              disabled={isSaving || isUploading}
              aria-label="Close dialog"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
            {/* Image Drop Zone (Profile Avatar at the Top) */}
            <div className="flex flex-col items-center space-y-1.5 pb-2">
              <label className="text-sm font-medium text-slate-700">
                Profile Image
              </label>
              <ImageDropZone
                previewUrl={finalPreviewUrl}
                isDragging={isDragging}
                hasFile={!!file || (!!profile?.imageKey && !uploadedKey && !hasClearedOriginalImage)}
                onFileSelect={selectFile}
                onClear={handleClear}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  selectFile(e.dataTransfer.files[0]);
                }}
                inputRef={fileInputRef}
              />
              {isUploading && (
                <p className="text-xs text-blue-600 animate-pulse mt-1">
                  Uploading new image… {uploadProgress ? `${uploadProgress.percent}%` : ""}
                </p>
              )}
              {(file || (profile?.imageKey && !hasClearedOriginalImage)) && !isUploading && (
                <p className="text-xs text-slate-500 max-w-[200px] truncate mt-1 text-center" title={file?.name || getOriginalFilename(profile?.imageKey || "")}>
                  File: {file?.name || getOriginalFilename(profile?.imageKey || "")}
                </p>
              )}
            </div>

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
                disabled={isSaving || isUploading}
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
                disabled={isSaving || isUploading}
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
                disabled={isSaving || isUploading}
                aria-required="true"
              />
            </div>

            {/* Error */}
            {combinedError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {combinedError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                disabled={isSaving || isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSaving || isUploading || (!!file && !uploadedKey) || !isDirty}
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
