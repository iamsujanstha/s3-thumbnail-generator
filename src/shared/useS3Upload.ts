"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateMD5 } from "@/lib/md5";

export type S3UploadStep =
  | "idle"
  | "presigning"
  | "uploading"
  | "saving"; // multipart completion

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function useS3Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [step, setStep] = useState<S3UploadStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    uploaded: number;
    total: number;
    percent: number;
  } | null>(null);

  const uploadedKeyRef = useRef<string | null>(null);

  // Sync ref with uploadedKey state
  useEffect(() => {
    uploadedKeyRef.current = uploadedKey;
  }, [uploadedKey]);

  // Clean up S3 object on unmount if form was not submitted
  useEffect(() => {
    return () => {
      if (uploadedKeyRef.current) {
        fetch("/api/s3/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: uploadedKeyRef.current }),
        }).catch((err) => {
          console.warn("[useS3Upload] Unmount cleanup failed:", err);
        });
      }
    };
  }, []);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  async function deleteS3Object(key: string) {
    try {
      await fetch("/api/s3/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    } catch (err) {
      console.warn(
        `[useS3Upload] Failed to delete temporary S3 file for key ${key}:`,
        err
      );
    }
  }

  async function uploadFile(fileToUpload: File, strategy: "trigger" | "dynamic" = "trigger") {
    setError(null);
    setUploadedKey(null);
    try {
      setUploadProgress(null);
      let imageKey: string;
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
      const useMultipart = fileToUpload.size > CHUNK_SIZE;

      if (useMultipart) {
        /* 1 — Initiate Multipart Upload */
        setStep("presigning");
        const initRes = await fetch("/api/s3/multipart/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: fileToUpload.name,
            contentType: fileToUpload.type,
            size: fileToUpload.size,
            strategy,
          }),
        });
        if (!initRes.ok)
          throw new Error("Could not prepare the multipart upload. Try again.");

        const { uploadId, key, parts } = (await initRes.json()) as {
          uploadId: string;
          key: string;
          parts: { partNumber: number; uploadUrl: string }[];
        };
        imageKey = key;

        // Initialize progress for multipart upload
        setUploadProgress({ uploaded: 0, total: parts.length, percent: 0 });

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
            const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);
            const chunk = fileToUpload.slice(start, end);

            const uploadRes = await fetch(part.uploadUrl, {
              method: "PUT",
              body: chunk,
            });

            if (!uploadRes.ok) {
              throw new Error(`Upload of part ${part.partNumber} failed.`);
            }

            const etag = uploadRes.headers.get("ETag");
            if (!etag) {
              throw new Error(
                `Missing ETag header for part ${part.partNumber}.`
              );
            }

            completedParts.push({
              PartNumber: part.partNumber,
              ETag: etag.replace(/"/g, ""), // strip surrounding quotes if present
            });

            // Update progress after chunk completion
            const currentUploaded = completedParts.length;
            setUploadProgress({
              uploaded: currentUploaded,
              total: parts.length,
              percent: Math.round((currentUploaded / parts.length) * 100),
            });
          }
        };

        // Spawn workers
        const workers = Array.from({ length: concurrencyLimit }, () =>
          uploadWorker()
        );
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
            key: imageKey,
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
        const arrayBuffer = await fileToUpload.arrayBuffer();
        const contentMd5 = calculateMD5(arrayBuffer);

        const presignRes = await fetch("/api/s3/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: fileToUpload.name,
            contentType: fileToUpload.type,
            size: fileToUpload.size,
            contentMd5,
            strategy,
          }),
        });
        if (!presignRes.ok)
          throw new Error("Could not prepare the upload. Try again.");
        const { uploadUrl, imageKey: key } = (await presignRes.json()) as {
          uploadUrl: string;
          imageKey: string;
        };
        imageKey = key;

        /* 2 — Upload to S3 (Standard PUT) */
        setStep("uploading");
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": fileToUpload.type,
            "Content-MD5": contentMd5,
          },
          body: fileToUpload,
        });
        if (!uploadRes.ok) {
          const s3Err = await uploadRes.text().catch(() => "");
          throw new Error(
            `Image upload failed (${uploadRes.status})${s3Err ? `: ${s3Err.slice(0, 200)}` : "."
            }`
          );
        }
      }

      setUploadedKey(imageKey);
      setStep("idle");
      setUploadProgress(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong during image upload."
      );
      setStep("idle");
      setUploadProgress(null);
      setFile(null); // Clear file representation if upload failed
    }
  }

  function selectFile(candidate: File | undefined, strategy: "trigger" | "dynamic" = "trigger") {
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

    if (uploadedKey) {
      deleteS3Object(uploadedKey);
    }

    setFile(candidate);
    setStep("idle");
    uploadFile(candidate, strategy);
  }

  function clearFile() {
    if (uploadedKey) {
      deleteS3Object(uploadedKey);
    }
    setFile(null);
    setUploadedKey(null);
    setUploadProgress(null);
    setStep("idle");
  }

  return {
    file,
    setFile,
    uploadedKey,
    setUploadedKey,
    step,
    setStep,
    error,
    setError,
    uploadProgress,
    setUploadProgress,
    previewUrl,
    selectFile,
    clearFile,
    deleteS3Object,
  };
}
