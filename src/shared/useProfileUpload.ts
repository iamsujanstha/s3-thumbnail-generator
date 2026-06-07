"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type UploadStep =
  | "idle"
  | "presigning"
  | "uploading"
  | "saving"
  | "complete";

export type ProfileFormState = {
  fullName: string;
  jobTitle: string;
  company:  string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const STEP_LABELS: Record<UploadStep, string> = {
  idle:       "Ready",
  presigning: "Securing upload…",
  uploading:  "Uploading image…",
  saving:     "Saving profile…",
  complete:   "Done",
};

export function useProfileUpload() {
  const queryClient  = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<ProfileFormState>({
    fullName: "",
    jobTitle: "",
    company:  "",
  });
  const [file, setFile]             = useState<File | null>(null);
  const [step, setStep]             = useState<UploadStep>("idle");
  const [error, setError]           = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  const isBusy =
    step === "presigning" || step === "uploading" || step === "saving";

  function updateField(field: keyof ProfileFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectFile(candidate: File | undefined) {
    setError(null);
    if (!candidate) return;
    if (!ALLOWED_TYPES.has(candidate.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setFile(candidate);
    setStep("idle");
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Add a profile image before creating the profile.");
      return;
    }

    try {
      /* 1 — Presign */
      setStep("presigning");
      const presignRes = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename:    file.name,
          contentType: file.type,
          size:        file.size,
        }),
      });
      if (!presignRes.ok)
        throw new Error("Could not prepare the upload. Try again.");
      const { uploadUrl, imageKey } = (await presignRes.json()) as {
        uploadUrl: string;
        imageKey:  string;
      };

      /* 2 — Upload to S3 */
      setStep("uploading");
      const uploadRes = await fetch(uploadUrl, {
        method:  "PUT",
        headers: { "Content-Type": file.type },
        body:    file,
      });
      if (!uploadRes.ok) {
        const s3Err = await uploadRes.text().catch(() => "");
        throw new Error(
          `Image upload failed (${uploadRes.status})${
            s3Err ? `: ${s3Err.slice(0, 200)}` : "."
          }`
        );
      }

      /* 3 — Save profile */
      setStep("saving");
      const profileRes = await fetch("/api/profiles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, imageKey }),
      });
      if (!profileRes.ok)
        throw new Error("Profile could not be saved after the upload.");

      /* 4 — Invalidate the profiles list cache so /profiles always shows
             the newly created profile at the top when navigated to next. */
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });

      setStep("complete");
      setForm({ fullName: "", jobTitle: "", company: "" });
      clearFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("idle");
    }
  }

  return {
    fileInputRef,
    form, updateField,
    file, previewUrl, isDragging,
    step, isBusy, error,
    selectFile, clearFile, handleSubmit,
    setIsDragging,
  };
}
