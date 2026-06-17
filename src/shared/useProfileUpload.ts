"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useS3Upload, type S3UploadStep } from "@/shared/useS3Upload";

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

  const {
    file,
    setFile,
    uploadedKey,
    setUploadedKey,
    step: s3Step,
    setStep: setS3Step,
    error: s3Error,
    setError: setS3Error,
    uploadProgress,
    setUploadProgress,
    previewUrl,
    selectFile: s3SelectFile,
    clearFile: s3ClearFile,
  } = useS3Upload();

  const [formStep, setFormStep] = useState<UploadStep>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Coordinate the visual step
  const step = useMemo<UploadStep>(() => {
    if (formStep !== "idle") return formStep;
    return s3Step as UploadStep;
  }, [formStep, s3Step]);

  // Combine error states
  const error = formError || s3Error;

  const isBusy =
    step === "presigning" || step === "uploading" || step === "saving";

  function updateField(field: keyof ProfileFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectFile(candidate: File | undefined) {
    setFormStep("idle");
    setFormError(null);
    s3SelectFile(candidate);
  }

  function clearFile() {
    setFormStep("idle");
    setFormError(null);
    s3ClearFile();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (!file) {
      setFormError("Add a profile image before creating the profile.");
      return;
    }

    if (!uploadedKey) {
      setFormError("Please wait for the image upload to complete.");
      return;
    }

    try {
      /* 3 — Save profile */
      setFormStep("saving");
      const profileRes = await fetch("/api/profiles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, imageKey: uploadedKey }),
      });
      if (!profileRes.ok)
        throw new Error("Profile could not be saved after the upload.");

      /* 4 — Invalidate the profiles list cache so /profiles always shows
             the newly created profile at the top when navigated to next. */
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });

      setFormStep("complete");
      setForm({ fullName: "", jobTitle: "", company: "" });
      
      setFile(null);
      setUploadedKey(null);
      setUploadProgress(null);
      setS3Step("idle");
      setS3Error(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
      setFormStep("idle");
    }
  }

  return {
    fileInputRef,
    form, updateField,
    file, previewUrl, isDragging,
    step, isBusy, error,
    selectFile, clearFile, handleSubmit,
    setIsDragging,
    uploadProgress,
    uploadedKey,
  };
}
