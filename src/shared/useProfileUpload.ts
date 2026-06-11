"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { calculateMD5 } from "@/lib/md5";

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

const MAX_FILE_SIZE = 200 * 1024 * 1024;
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
      let imageKey: string;
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
      const useMultipart = file.size > CHUNK_SIZE;

      if (useMultipart) {
        /* 1 — Initiate Multipart Upload */
        setStep("presigning");
        const initRes = await fetch("/api/s3/multipart/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename:    file.name,
            contentType: file.type,
            size:        file.size,
          }),
        });
        if (!initRes.ok)
          throw new Error("Could not prepare the multipart upload. Try again.");
        
        const { uploadId, key, parts } = (await initRes.json()) as {
          uploadId: string;
          key:      string;
          parts:    { partNumber: number; uploadUrl: string }[];
        };
        imageKey = key;

        /* 2 — Upload chunks concurrently */
        setStep("uploading");
        
        // Limit concurrency to 3 parallel chunk uploads
        const uploadQueue = [...parts];
        const completedParts: { PartNumber: number; ETag: string }[] = [];
        const concurrencyLimit = 3;

        const uploadWorker = async () => {
          while (uploadQueue.length > 0) {
            const part = uploadQueue.shift();
            if (!part) break;

            const start = (part.partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const uploadRes = await fetch(part.uploadUrl, {
              method: "PUT",
              body:   chunk,
            });

            if (!uploadRes.ok) {
              throw new Error(`Upload of part ${part.partNumber} failed.`);
            }

            const etag = uploadRes.headers.get("ETag");
            if (!etag) {
              throw new Error(`Missing ETag header for part ${part.partNumber}.`);
            }

            completedParts.push({
              PartNumber: part.partNumber,
              ETag:       etag.replace(/"/g, ""), // strip surrounding quotes if present
            });
          }
        };

        // Spawn workers
        const workers = Array.from({ length: concurrencyLimit }, () => uploadWorker());
        await Promise.all(workers);

        // Sort parts by part number
        completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

        /* 3 — Complete Multipart Upload */
        setStep("saving");
        const completeRes = await fetch("/api/s3/multipart/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId,
            key:  imageKey,
            parts: completedParts,
          }),
        });
        if (!completeRes.ok) {
          throw new Error("Could not finalize S3 multipart upload.");
        }
      } else {
        /* 1 — Presign (Standard PUT) */
        setStep("presigning");

        // Calculate MD5 of file to ensure payload integrity
        const arrayBuffer = await file.arrayBuffer();
        const contentMd5 = calculateMD5(arrayBuffer);

        const presignRes = await fetch("/api/s3/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename:    file.name,
            contentType: file.type,
            size:        file.size,
            contentMd5,
          }),
        });
        if (!presignRes.ok)
          throw new Error("Could not prepare the upload. Try again.");
        const { uploadUrl, imageKey: key } = (await presignRes.json()) as {
          uploadUrl: string;
          imageKey:  string;
        };
        imageKey = key;

        /* 2 — Upload to S3 (Standard PUT) */
        setStep("uploading");
        const uploadRes = await fetch(uploadUrl, {
          method:  "PUT",
          headers: {
            "Content-Type":  file.type,
            "x-amz-tagging": "cleanup=true",
            "Content-MD5":   contentMd5,
          },
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
