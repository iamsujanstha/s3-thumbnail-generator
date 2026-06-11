"use client";

/**
 * ImageDropZone
 * Self-contained drag-and-drop / click-to-browse image picker.
 * Receives only the pieces of state it needs — no upload logic inside.
 */
import Image from "next/image";
import { useId } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/shared/utils";

type Props = {
  previewUrl:   string | null;
  isDragging:   boolean;
  hasFile:      boolean;
  onFileSelect: (file: File | undefined) => void;
  onClear:      () => void;
  onDragEnter:  (e: React.DragEvent) => void;
  onDragLeave:  () => void;
  onDrop:       (e: React.DragEvent) => void;
  inputRef:     React.RefObject<HTMLInputElement>;
};

export function ImageDropZone({
  previewUrl,
  isDragging,
  hasFile,
  onFileSelect,
  onClear,
  onDragEnter,
  onDragLeave,
  onDrop,
  inputRef,
}: Props) {
  const hintId = useId();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload profile image — click or drag a file here"
      aria-describedby={hasFile ? undefined : hintId}
      className={cn(
        "relative flex min-h-64 cursor-pointer flex-col items-center justify-center",
        "overflow-hidden rounded-xl border-2 border-dashed p-6 text-center",
        "transition-all duration-normal",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isDragging
          ? "border-blue-500 bg-blue-50 scale-[1.01]"
          : hasFile
          ? "border-blue-300 bg-blue-50/30"
          : "border-slate-200 bg-white/75 hover:border-slate-300 hover:bg-slate-50/50"
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-hidden="true"
        onChange={(e) => onFileSelect(e.target.files?.[0])}
      />

      {previewUrl ? (
        <Preview
          previewUrl={previewUrl}
          onClear={onClear}
        />
      ) : (
        <Placeholder isDragging={isDragging} hintId={hintId} />
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */
function Preview({
  previewUrl,
  onClear,
}: {
  previewUrl: string;
  onClear: () => void;
}) {
  return (
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
          onClear();
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </>
  );
}

function Placeholder({
  isDragging,
  hintId,
}: {
  isDragging: boolean;
  hintId: string;
}) {
  return (
    <div className="space-y-3 select-none">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <ImagePlus className="h-7 w-7" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-slate-900">
          {isDragging ? "Drop to upload" : "Drop an image here"}
        </p>
        <p id={hintId} className="mt-1 text-sm text-slate-500">
          JPG, PNG, or WebP — up to 200 MB (Multipart chunked above 5MB)
        </p>
      </div>
      <p className="text-xs text-blue-600 underline underline-offset-2">
        or click to browse
      </p>
    </div>
  );
}
