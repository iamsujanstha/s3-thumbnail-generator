"use client";

/**
 * ProfileForm — layout shell + form fields + submit button
 *
 * All upload logic lives in useProfileUpload.
 * The image picker lives in ImageDropZone.
 * The progress bar is a tiny local component.
 */
import Link from "next/link";
import { useEffect, useId } from "react";
import { CheckCircle2, Loader2, UploadCloud, UsersRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImageDropZone } from "@/components/profile/ImageDropZone";
import { useProfileUpload, STEP_LABELS, type UploadStep } from "@/shared/useProfileUpload";
import { cn, getOriginalFilename } from "@/shared/utils";

/* ─── Progress bar ───────────────────────────────────────────── */
const STEP_ORDER: UploadStep[] = [
  "idle", "presigning", "uploading", "saving", "complete",
];

function UploadProgressBar({ step }: { step: UploadStep }) {
  if (step === "idle" || step === "complete") return null;
  const active   = STEP_ORDER.indexOf(step);
  const segments = ["presigning", "uploading", "saving"] as const;
  return (
    <div className="upload-step-bar" aria-hidden="true">
      {segments.map((s, i) => (
        <div
          key={s}
          className={cn(
            "upload-step-bar__segment",
            active > i + 1 && "upload-step-bar__segment--done",
            active === i + 1 && "upload-step-bar__segment--active"
          )}
        />
      ))}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export function ProfileForm() {
  const statusId = useId();
  const {
    fileInputRef,
    form, updateField,
    file, previewUrl, isDragging,
    step, isBusy, error,
    selectFile, clearFile, handleSubmit,
    setIsDragging,
    uploadProgress,
    uploadedKey,
  } = useProfileUpload();

  /* Revoke object URL on unmount / file change */
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  return (
    <section className="profile-form-shell">
      {/* ── Left marketing copy ─────────────────────────────── */}
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

      {/* ── Form card ────────────────────────────────────────── */}
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
                {uploadProgress && (
                  <span className="font-semibold text-blue-600 block sm:inline sm:ml-2">
                    {uploadProgress.percent}% ({uploadProgress.uploaded} of {uploadProgress.total} chunks)
                  </span>
                )}
              </p>
            </div>
            {step === "complete" && (
              <CheckCircle2
                className="mt-1 h-5 w-5 shrink-0 text-emerald-500"
                aria-hidden="true"
              />
            )}
          </div>
          <UploadProgressBar step={step} />
        </CardHeader>

        <CardContent>
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            aria-describedby={statusId}
            noValidate
          >
            {/* ── Image picker (Profile Avatar at the Top) ────────────────── */}
            <div className="flex flex-col items-center space-y-1.5 pb-2">
              <label className="text-sm font-medium text-slate-700">
                Profile Image
              </label>
              <ImageDropZone
                previewUrl={previewUrl}
                isDragging={isDragging}
                hasFile={!!file}
                onFileSelect={selectFile}
                onClear={clearFile}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  selectFile(e.dataTransfer.files[0]);
                }}
                inputRef={fileInputRef}
              />
              {(file || uploadedKey) && (
                <p className="text-xs text-slate-500 max-w-[200px] truncate mt-1 text-center" title={file?.name || getOriginalFilename(uploadedKey || "")}>
                  File: {file?.name || getOriginalFilename(uploadedKey || "")}
                </p>
              )}
            </div>

            {/* ── Text fields ─────────────────────────────────── */}
            <div className="profile-field-grid">
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
                  Full name{" "}
                  <span aria-hidden="true" className="text-red-500">*</span>
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
                  Job title{" "}
                  <span aria-hidden="true" className="text-red-500">*</span>
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
                  Company{" "}
                  <span aria-hidden="true" className="text-red-500">*</span>
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

            {/* ── Error ─────────────────────────────────────────── */}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {/* ── Success ───────────────────────────────────────── */}
            {step === "complete" && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Profile saved. Thumbnail generation runs asynchronously.
              </p>
            )}

            {/* ── Submit ────────────────────────────────────────── */}
            <Button
              className="w-full"
              disabled={isBusy || (!!file && !uploadedKey)}
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
