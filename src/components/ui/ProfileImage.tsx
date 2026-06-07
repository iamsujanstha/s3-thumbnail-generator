"use client";

/**
 * ProfileImage — generic resilient image component
 * ─────────────────────────────────────────────────────────────
 * Three states, all handled visually:
 *
 *   loading  → shimmer skeleton while the browser fetches the bytes
 *   loaded   → image fades in over the shimmer (no pop / jump)
 *   error    → broken indicator with optional label (WifiOff icon +
 *               amber background) so the user knows something failed
 *
 * Variants:
 *   "avatar"  — circle, 40 × 40, for table rows
 *   "hero"    — full-width aspect-[4/3], for the detail sheet
 *   "card"    — full-width aspect-[4/3], for profile grid cards
 *
 * Usage:
 *   <ProfileImage src={url} alt="John Doe" variant="avatar" />
 *   <ProfileImage src={url} alt="John Doe" variant="hero" eager />
 *
 * Memo-safe: only re-renders when src changes. Keep src stable
 * (proxy URL, not presigned URL) to avoid unnecessary re-fetches.
 */

import { memo, useState, useCallback } from "react";
import { ImageOff, UserCircle2 } from "lucide-react";
import { cn } from "@/shared/utils";

/* ─── Types ──────────────────────────────────────────────────── */
export type ProfileImageVariant = "avatar" | "hero" | "card";

type ImageState = "loading" | "loaded" | "error";

interface ProfileImageProps {
  /** Stable proxy URL e.g. /api/img/uploads/thumbnails/abc.webp */
  src:      string | null | undefined;
  alt:      string;
  variant:  ProfileImageVariant;
  /** Use eager loading for above-the-fold images (e.g. detail sheet) */
  eager?:   boolean;
  className?: string;
}

/* ─── Variant configs ─────────────────────────────────────────── */
const VARIANT_WRAPPER: Record<ProfileImageVariant, string> = {
  avatar: "relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100",
  hero:   "relative aspect-[4/3] w-full overflow-hidden",
  card:   "relative aspect-[4/3] w-full overflow-hidden",
};

const VARIANT_FALLBACK_ICON: Record<ProfileImageVariant, React.ReactNode> = {
  avatar: <UserCircle2 className="h-6 w-6 text-slate-400" />,
  hero:   <UserCircle2 className="h-16 w-16 text-slate-300" />,
  card:   <UserCircle2 className="h-12 w-12 text-slate-300" />,
};

const VARIANT_ERROR_ICON: Record<ProfileImageVariant, React.ReactNode> = {
  avatar: <ImageOff className="h-4 w-4 text-amber-500" />,
  hero:   <ImageOff className="h-8 w-8 text-amber-500" />,
  card:   <ImageOff className="h-6 w-6 text-amber-500" />,
};

/* ─── Component ──────────────────────────────────────────────── */
export const ProfileImage = memo(function ProfileImage({
  src,
  alt,
  variant,
  eager = false,
  className,
}: ProfileImageProps) {
  const [state, setState] = useState<ImageState>(src ? "loading" : "error");

  const handleLoad  = useCallback(() => setState("loaded"), []);
  const handleError = useCallback(() => setState("error"),  []);

  const wrapperCls = cn(VARIANT_WRAPPER[variant], className);

  /* ── No src → plain placeholder ──────────────────────────── */
  if (!src) {
    return (
      <div className={wrapperCls}>
        <Placeholder variant={variant} />
      </div>
    );
  }

  return (
    <div className={wrapperCls}>

      {/* 1 ── Shimmer — visible while loading, hidden once done */}
      <Shimmer visible={state === "loading"} />

      {/* 2 ── Image — fades in on load, invisible until then */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          "transition-opacity duration-300",
          state === "loaded" ? "opacity-100" : "opacity-0",
          // keep the element in DOM even during error so the browser
          // doesn't attempt to refetch on the next render cycle
          state === "error"  ? "invisible" : "visible"
        )}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* 3 ── Error fallback — shown only when load fails */}
      {state === "error" && <ErrorState variant={variant} />}
    </div>
  );
});

/* ─── Internal pieces ────────────────────────────────────────── */

/** Animated shimmer shown while the image bytes are being fetched */
function Shimmer({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]"
      style={{ animation: "shimmer 1.4s ease-in-out infinite" }}
    />
  );
}

/** No src — neutral placeholder */
function Placeholder({ variant }: { variant: ProfileImageVariant }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-slate-100"
    >
      {VARIANT_FALLBACK_ICON[variant]}
    </div>
  );
}

/**
 * Error state — amber-tinted background + broken-image icon.
 * Gives the user a clear visual signal that the image failed
 * rather than showing a blank/broken browser icon.
 */
function ErrorState({ variant }: { variant: ProfileImageVariant }) {
  const isAvatar = variant === "avatar";
  return (
    <div
      role="img"
      aria-label="Image unavailable"
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-1",
        "bg-amber-50",
        isAvatar ? "" : "border border-amber-100"
      )}
    >
      {VARIANT_ERROR_ICON[variant]}
      {!isAvatar && (
        <p className="text-xs font-medium text-amber-600">Image unavailable</p>
      )}
    </div>
  );
}
