"use client";

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
    <div className="flex flex-col items-center space-y-3">
      <div className="relative group">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload profile image — click or drag a file here"
          aria-describedby={hasFile ? undefined : hintId}
          className={cn(
            "relative flex h-36 w-36 cursor-pointer flex-col items-center justify-center",
            "overflow-hidden rounded-full border-2 border-dashed text-center",
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
            <>
              <Image
                src={previewUrl}
                alt="Selected profile image preview"
                fill
                className="object-cover animate-fade-in"
                sizes="144px"
                unoptimized
              />
              
              {/* Dark overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200">
                <span className="text-[10px] font-semibold uppercase tracking-wider">Change</span>
                <span className="text-[9px] text-white/80">Photo</span>
              </div>
            </>
          ) : (
            <Placeholder isDragging={isDragging} hintId={hintId} />
          )}
        </div>

        {/* Delete cross icon: positioned on the top-right overlapping the circle, completely unclipped */}
        {previewUrl && (
          <button
            type="button"
            aria-label="Remove selected image"
            className={cn(
              "absolute right-1 top-1 z-10 rounded-full bg-white p-1.5",
              "text-slate-500 border border-slate-200 shadow-md transition-all duration-normal",
              "hover:bg-red-50 hover:text-red-600 hover:border-red-200 hover:scale-110 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!hasFile && (
        <p id={hintId} className="text-[11px] text-slate-400 text-center max-w-[220px]">
          JPG, PNG, or WebP — max 200 MB (Multipart above 5MB)
        </p>
      )}
    </div>
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
    <div className="space-y-1 select-none p-4">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold text-slate-700">
        {isDragging ? "Drop here" : "Upload"}
      </p>
    </div>
  );
}
