"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, ImagePlus, Loader2,
  UploadCloud, UsersRound, X, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

/* ─── Types ────────────────────────────────────────────────────── */
type FormState = {
  fullName: string;
  jobTitle: string;
  company: string;
};

type UploadStep = "idle" | "presigning" | "uploading" | "saving" | "complete";

/* ─── Constants ─────────────────────────────────────────────────── */
const MAX_FILE_SIZE   = 5 * 1024 * 1024;
const ALLOWED_TYPES   = new Set(["image/jpeg", "image/png", "image/webp"]);

const STEP_ORDER: UploadStep[] = ["idle", "presigning", "uploading", "saving", "complete"];

const STEP_LABELS: Record<UploadStep, string> = {
  idle:       "Ready",
  presigning: "Securing upload…",
  uploading:  "Uploading image…",
  saving:     "Saving profile…",
  complete:   "Done",
};

/* ─── Progress bar ───────────────────────────────────────────────── */
function ProgressBar({ step }: { step: UploadStep }) {
  const active = STEP_ORDER.indexOf(step);
  // Only show during active upload (not idle/complete)
  if (step === "idle" || step === "complete") return null;
  const segments = ["presigning", "uploading", "saving"] as const;
  return (
    <div className="upload-step-bar" aria-hidden="true">
      {segments.map((s, i) => (
        <div
          key={s}
          className={cn(
            "upload-step-bar__segment",
            active > i && "upload-step-bar__segment--done",
            active === i + 1 && "upload-step-bar__segment--active"
          )}
        />
      ))}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export function ProfileForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneId = useId();
  const statusId   = useId();

  const [form, setForm]       = useState<FormState>({ fullName: "", jobTitle: "", company: "" });
  const [file, setFile]       = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep]       = useState<UploadStep>("idle");
  const [error, setError]     = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const isBusy = step === "presigning" || step === "uploading" || step === "saving";

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function updateField(field: keyof FormState, value: string) {
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Add a profile image before creating the profile.");
      return;
    }

    try {
      /* 1 — Get presigned URL */
      setStep("presigning");
      const presignRes = await fetch("/api/s3/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      if (!presignRes.ok) throw new Error("Could not prepare the upload. Try again.");
      const { uploadUrl, imageKey } = await presignRes.json() as {
        uploadUrl: string;
        imageKey: string;
      };

      /* 2 — Upload to S3 */
      setStep("uploading");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        const s3Err = await uploadRes.text().catch(() => "");
        throw new Error(
          `Image upload failed (${uploadRes.status})${s3Err ? `: ${s3Err.slice(0, 200)}` : "."}`
        );
      }

      /* 3 — Save profile */
      setStep("saving");
      const profileRes = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, imageKey }),
      });
      if (!profileRes.ok) throw new Error("Profile could not be saved after the upload.");

      /* 4 — Done */
      setStep("complete");
      setForm({ fullName: "", jobTitle: "", company: "" });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("idle");
    }
  }

  return (
    <section className="profile-form-shell">
      {/* ── Left copy ─────────────────────────────────────────────── */}
      <div className="profile-form-copy space-y-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          Direct-to-S3 profile creation
        </div>

        <div className="space-y-4">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl lg:text-6xl">
            Create sharp profiles without slowing your app.
          </h1>
          <p className="max-w-lg text-base leading-7 text-slate-600">
            Upload original images straight to S3, save only durable object keys
            in MongoDB, and let Lambda prepare fast thumbnails in the background.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/profiles">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              View profiles
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Form card ──────────────────────────────────────────────── */}
      <Card className="profile-form-card radiant-panel overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>New user profile</CardTitle>
              <p
                id={statusId}
                aria-live="polite"
                className="mt-1 text-sm text-slate-500"
              >
                {STEP_LABELS[step]}
              </p>
            </div>
            {step === "complete" && (
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
            )}
          </div>
          <ProgressBar step={step} />
        </CardHeader>

        <CardContent>
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            aria-describedby={statusId}
            noValidate
          >
            {/* ── Text fields ─────────────────────────────────────── */}
            <div className="profile-field-grid">
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                  Full name <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <Input
                  id="fullName"
                  required
                  aria-required="true"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Avery Stone"
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="jobTitle" className="text-sm font-medium text-slate-700">
                  Job title <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <Input
                  id="jobTitle"
                  required
                  aria-required="true"
                  value={form.jobTitle}
                  onChange={(e) => updateField("jobTitle", e.target.value)}
                  placeholder="Product Lead"
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="company" className="text-sm font-medium text-slate-700">
                  Company <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <Input
                  id="company"
                  required
                  aria-required="true"
                  value={form.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  placeholder="Northstar Labs"
                  disabled={isBusy}
                />
              </div>
            </div>

            {/* ── Drop zone ────────────────────────────────────────── */}
            <div
              id={dropZoneId}
              role="button"
              tabIndex={0}
              aria-label="Upload profile image — click or drag a file here"
              aria-describedby={file ? undefined : dropZoneId + "-hint"}
              className={cn(
                "relative flex min-h-64 cursor-pointer flex-col items-center justify-center",
                "overflow-hidden rounded-xl border-2 border-dashed p-6 text-center",
                "transition-all duration-normal",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isDragging
                  ? "border-blue-500 bg-blue-50 scale-[1.01]"
                  : file
                  ? "border-blue-300 bg-blue-50/30"
                  : "border-slate-200 bg-white/75 hover:border-slate-300 hover:bg-slate-50/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                selectFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-hidden="true"
                onChange={(e) => selectFile(e.target.files?.[0])}
              />

              {previewUrl ? (
                <>
                  <Image
                    src={previewUrl}
                    alt="Selected profile image preview"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 520px"
                    unoptimized
                  />
                  <button
                    type="button"
                    aria-label="Remove selected image"
                    className={cn(
                      "absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5",
                      "text-slate-700 shadow-medium transition hover:bg-white hover:scale-110",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="space-y-3 select-none">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <ImagePlus className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {isDragging ? "Drop to upload" : "Drop an image here"}
                    </p>
                    <p
                      id={dropZoneId + "-hint"}
                      className="mt-1 text-sm text-slate-500"
                    >
                      JPG, PNG, or WebP — up to 5 MB
                    </p>
                  </div>
                  <p className="text-xs text-blue-600 underline underline-offset-2">
                    or click to browse
                  </p>
                </div>
              )}
            </div>

            {/* ── Error ───────────────────────────────────────────── */}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {/* ── Success ─────────────────────────────────────────── */}
            {step === "complete" && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Profile saved. Thumbnail generation runs asynchronously in the background.
              </p>
            )}

            {/* ── Submit ──────────────────────────────────────────── */}
            <Button
              className="w-full"
              disabled={isBusy}
              type="submit"
              aria-label={isBusy ? STEP_LABELS[step] : "Create profile"}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
              )}
              {isBusy ? STEP_LABELS[step] : "Create profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
