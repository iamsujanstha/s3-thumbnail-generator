"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Pencil, BriefcaseBusiness, Building2,
  Calendar, Clock, Loader2, AlertTriangle, FileText,
} from "lucide-react";
import { getOriginalFilename } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileImage } from "@/components/ui/ProfileImage";
import type { ProfileDetailDto } from "@/shared/dtos";

type Props = {
  profileId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
};

async function fetchProfile(id: string): Promise<ProfileDetailDto> {
  const res = await fetch(`/api/profiles/${id}`);
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 pb-8" aria-hidden="true">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-4 px-6">
        <Skeleton className="h-7 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    </div>
  );
}

export function ProfileDetailSheet({ profileId, onClose, onEdit }: Props) {
  const isOpen = !!profileId;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => fetchProfile(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });

  /* Focus close button on open */
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => closeRef.current?.focus());
    }
  }, [isOpen]);

  /* Reset image size selection when a new profile is selected */
  useEffect(() => {
    setImageSize(null);
  }, [profileId]);

  /* Escape to close */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  /* Lock body scroll when open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-normal ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — always in DOM for CSS transition */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label="Profile detail"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-large transition-transform duration-slow ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            Profile detail
          </h2>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isFetching && <DetailSkeleton />}

          {isError && !isFetching && (
            <div
              role="alert"
              className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm text-slate-600">
                Could not load this profile. Try again later.
              </p>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {data && !isFetching && (
            <div className="pb-8">
              {/* Original image — ProfileImage handles loading shimmer,
                  fade-in on load, and broken-image error state */}
              <ProfileImage
                src={data.originalUrl}
                alt={`${data.fullName} — profile photo`}
                variant="hero"
                priority
                width={imageSize?.w}
                height={imageSize?.h}
              />

              {/* Dynamic Proxy Resizing Controls */}
              <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">On-the-Fly Proxy Resize:</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setImageSize(null)}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      imageSize === null
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Default
                  </button>
                  <button
                    onClick={() => setImageSize({ w: 300, h: 225 })}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      imageSize?.w === 300
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    300x225
                  </button>
                  <button
                    onClick={() => setImageSize({ w: 100, h: 100 })}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      imageSize?.w === 100
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    100x100
                  </button>
                  <button
                    onClick={() => setImageSize({ w: 50, h: 50 })}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      imageSize?.w === 50
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    50x50
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-5 px-6 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-2xl font-semibold leading-tight text-slate-900">
                    {data.fullName}
                  </h3>
                  <Badge variant="blue" className="mt-1 shrink-0">
                    Active
                  </Badge>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <BriefcaseBusiness
                      className="h-4 w-4 shrink-0 text-blue-500"
                      aria-hidden="true"
                    />
                    <dt className="sr-only">Job title</dt>
                    <dd className="text-slate-700">{data.jobTitle}</dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2
                      className="h-4 w-4 shrink-0 text-blue-500"
                      aria-hidden="true"
                    />
                    <dt className="sr-only">Company</dt>
                    <dd className="text-slate-700">{data.company}</dd>
                  </div>
                  {data.imageKey && (
                    <div className="flex items-center gap-3">
                      <FileText
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <dt className="sr-only">Filename</dt>
                      <dd className="text-slate-500 truncate" title={getOriginalFilename(data.imageKey)}>
                        {getOriginalFilename(data.imageKey)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <dt className="sr-only">Date added</dt>
                    <dd className="text-slate-500">
                      Added{" "}
                      <time dateTime={data.createdAt}>
                        {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                          new Date(data.createdAt)
                        )}
                      </time>
                    </dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock
                      className="h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <dt className="sr-only">Last updated</dt>
                    <dd className="text-slate-500">
                      Updated{" "}
                      <time dateTime={data.updatedAt}>
                        {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                          new Date(data.updatedAt)
                        )}
                      </time>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <Button className="w-full" onClick={() => onEdit(data.id)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit profile
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
