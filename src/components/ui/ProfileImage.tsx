"use client";

/**
 * ProfileImage — generic resilient image component
 * ─────────────────────────────────────────────────────────────
 * Uses next/image for automatic optimisation (WebP conversion,
 * responsive srcset, built-in lazy loading, blur placeholder).
 *
 * Three states, all handled visually:
 *
 *   loading → shimmer sweep while next/image fetches + optimises
 *   loaded  → image fades in over the shimmer (no pop / jump)
 *   error   → amber indicator so the user sees a failure, not a
 *              blank box or broken browser icon
 *
 * Variants
 *   "avatar" — 40×40 circle, table row thumbnails
 *   "hero"   — full-width aspect-[4/3], detail sheet
 *   "card"   — full-width aspect-[4/3], grid cards
 *
 * Why unoptimized={false} (default)?
 *   Images come through /api/img/[...key] — a same-origin URL.
 *   next/image treats same-origin paths as optimisable, so it
 *   produces WebP srcsets and caches the output on the CDN edge.
 *   The proxy sets Cache-Control: immutable on thumbnails, so
 *   next/image's own cache layer stacks on top.
 *
 * Usage:
 *   <ProfileImage src="/api/img/..." alt="Jane" variant="avatar" />
 *   <ProfileImage src="/api/img/..." alt="Jane" variant="hero" priority />
 */

import NextImage from "next/image";
import { memo, useState, useCallback } from "react";
import { ImageOff, UserCircle2 } from "lucide-react";
import { cn } from "@/shared/utils";

/* ─── Types ──────────────────────────────────────────────────── */
export type ProfileImageVariant = "avatar" | "hero" | "card";

type LoadState = "loading" | "loaded" | "error";

export interface ProfileImageProps {
  /** Stable same-origin proxy URL: /api/img/uploads/thumbnails/abc.webp
   *  Pass null/undefined to render a neutral placeholder. */
  src:       string | null | undefined;
  alt:       string;
  variant:   ProfileImageVariant;
  /** Pass priority for above-the-fold images (disables lazy loading) */
  priority?: boolean;
  className?: string;
}

/* ─── Variant maps ───────────────────────────────────────────── */

/** Wrapper element classes per variant */
const WRAPPER_CLS: Record<ProfileImageVariant, string> = {
  avatar: "relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100",
  hero:   "relative aspect-[4/3] w-full overflow-hidden bg-slate-100",
  card:   "relative aspect-[4/3] w-full overflow-hidden bg-slate-100",
};

/** next/image sizes hint — tells the browser which breakpoint to pick */
const IMG_SIZES: Record<ProfileImageVariant, string> = {
  avatar: "40px",
  hero:   "(max-width: 768px) 100vw, 448px",
  card:   "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
};

/** Placeholder icon rendered when src is absent */
const PLACEHOLDER_ICON: Record<ProfileImageVariant, React.ReactNode> = {
  avatar: <UserCircle2 className="h-6 w-6 text-slate-400"  aria-hidden="true" />,
  hero:   <UserCircle2 className="h-16 w-16 text-slate-300" aria-hidden="true" />,
  card:   <UserCircle2 className="h-12 w-12 text-slate-300" aria-hidden="true" />,
};

/** Broken-image icon shown in the error state */
const ERROR_ICON: Record<ProfileImageVariant, React.ReactNode> = {
  avatar: <ImageOff className="h-4 w-4 text-amber-500" aria-hidden="true" />,
  hero:   <ImageOff className="h-8 w-8 text-amber-500" aria-hidden="true" />,
  card:   <ImageOff className="h-6 w-6 text-amber-500" aria-hidden="true" />,
};

/* ─── Main component ─────────────────────────────────────────── */
export const ProfileImage = memo(function ProfileImage({
  src,
  alt,
  variant,
  priority = false,
  className,
}: ProfileImageProps) {
  const [state, setState] = useState<LoadState>(src ? "loading" : "error");

  // Stable callbacks — never cause a re-render of the parent
  const onLoad  = useCallback(() => setState("loaded"), []);
  const onError = useCallback(() => setState("error"),  []);

  const wrapperCls = cn(WRAPPER_CLS[variant], className);

  /* No src → neutral placeholder, no network request */
  if (!src) {
    return (
      <div className={wrapperCls}>
        <PlaceholderState variant={variant} />
      </div>
    );
  }

  return (
    <div className={wrapperCls}>

      {/* ── 1. Shimmer ── visible while next/image is loading ── */}
      {state === "loading" && <Shimmer />}

      {/* ── 2. next/image ─────────────────────────────────────
           - fill makes it cover the wrapper regardless of variant
           - onLoad fires when the image is decoded and painted
           - onError fires on any network / 404 / decode failure
           - The opacity transition creates the blur→sharp feel:
             next/image generates a tiny base64 blurDataURL from
             the image (via `placeholder="blur"` — see note below),
             then cross-fades to the full image once loaded.
             We also drive our own opacity for the shimmer hand-off.
      ──────────────────────────────────────────────────────── */}
      <NextImage
        src={src}
        alt={alt}
        fill
        sizes={IMG_SIZES[variant]}
        priority={priority}
        /**
         * "blur" placeholder: next/image generates a tiny (8×8px)
         * base64 version of the image server-side and renders it
         * immediately as a CSS background — giving the blur-in effect.
         * We combine this with our shimmer so there's always something
         * visible while the full image loads.
         *
         * NOTE: `placeholder="blur"` with external/dynamic src requires
         * a `blurDataURL`. We use a neutral slate-coloured 1×1 pixel
         * so the placeholder is always consistent regardless of the
         * image content, and there's no flash of an unrelated colour.
         */
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+uDVfwAJWgONnMg9EgAAAABJRU5ErkJggg=="
        className={cn(
          "object-cover transition-opacity duration-500 ease-in-out",
          state === "loaded" ? "opacity-100" : "opacity-0",
          state === "error"  ? "invisible"   : "visible",
        )}
        onLoad={onLoad}
        onError={onError}
      />

      {/* ── 3. Error state ──────────────────────────────────── */}
      {state === "error" && <ErrorState variant={variant} />}
    </div>
  );
});

/* ─── Sub-components ─────────────────────────────────────────── */

/**
 * Animated shimmer — the moving-gradient "loading" feel.
 * Positioned behind the image so the fade-in dissolves it naturally.
 */
function Shimmer() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-slate-200"
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-slate-200 via-white/60 to-slate-200"
      />
    </div>
  );
}

/** No src — show a neutral icon, no network request made */
function PlaceholderState({ variant }: { variant: ProfileImageVariant }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-slate-100"
    >
      {PLACEHOLDER_ICON[variant]}
    </div>
  );
}

/**
 * Error state — amber tint + broken-image icon.
 * Much clearer than a blank box or the browser's torn-image icon.
 * Hero/card variants also show a short label for extra clarity.
 */
function ErrorState({ variant }: { variant: ProfileImageVariant }) {
  const isAvatar = variant === "avatar";
  return (
    <div
      role="img"
      aria-label="Image unavailable"
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-1.5",
        "bg-amber-50",
        !isAvatar && "border border-amber-100",
      )}
    >
      {ERROR_ICON[variant]}
      {!isAvatar && (
        <p className="select-none text-xs font-medium text-amber-600">
          Image unavailable
        </p>
      )}
    </div>
  );
}
